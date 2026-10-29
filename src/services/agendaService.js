import pool from '../database/conexion.js';
import { ErrorHttp } from '../utils/errorHttp.js';
import {
  validarCamposRequeridos,
  validarEnteroPositivo,
  validarFormatoFecha,
  validarFormatoHora,
} from '../utils/validaciones.js';
import { fechaDeHoy, generarHorarios, horaActual } from '../utils/horarios.js';

const CAMPOS_REQUERIDOS = ['hora_entrada', 'hora_salida', 'fecha', 'id_medico', 'id_especialidad', 'id_sede'];

const ESTADO_CONFIRMADO = 'confirmado';

// Sin esta validacion, una fecha como '02/09/2026' o una hora como '9:00' llegan
// crudas al INSERT y MySQL responde con un error de tipo, que el controller
// traduce a un 500 generico. La consigna pide error controlado, no 500.
//
// Ademas, el formato estricto 'HH:MM' no es cosmetico: los horarios de turno se
// calculan a partir de estas horas (generarHorarios), y un '9:00' guardado en la
// agenda haria que ningun turno de esa franja se pueda reservar.
function validarFormatoAgenda({ fecha, hora_entrada, hora_salida }) {
  validarFormatoFecha(fecha);
  validarFormatoHora(hora_entrada, 'hora_entrada');
  validarFormatoHora(hora_salida, 'hora_salida');
  if (hora_salida <= hora_entrada) {
    throw new ErrorHttp(400, 'La hora de salida debe ser posterior a la hora de entrada');
  }
}

// El medico solo gestiona su propia agenda (en cualquier sede donde atienda).
// El operador gestiona la de cualquier medico, pero solo en su propia sede.
function validarPermisoAgenda(usuario, { id_medico, id_sede }) {
  if (usuario.rol === 'medico' && Number(id_medico) !== Number(usuario.id)) {
    throw new ErrorHttp(403, 'Un médico solo puede gestionar su propia agenda');
  }
  if (usuario.rol === 'operador' && Number(id_sede) !== Number(usuario.id_sede)) {
    throw new ErrorHttp(403, 'Un operador solo puede gestionar la agenda de su propia sede');
  }
}

async function buscarAgendaPorId(id) {
  const [registros] = await pool.query(
    `SELECT id, hora_entrada, hora_salida, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
            id_medico, id_especialidad, id_sede
       FROM agenda WHERE id = ?`,
    [id]
  );
  if (registros.length === 0) {
    throw new ErrorHttp(404, 'Turno de agenda no encontrado');
  }
  return registros[0];
}

// Un medico no puede tener dos rangos que se crucen el mismo dia, ni siquiera en
// sedes distintas: si no, dos sedes podrian darle turno a la misma hora. Los
// rangos que solo se tocan en el borde (09:00-13:00 y 13:00-17:00) no se cruzan.
// Las horas son 'HH:MM', asi que se comparan bien como texto. En la
// modificacion se excluye el propio rango (idExcluido).
async function validarSinSuperposicion({ id_medico, fecha, hora_entrada, hora_salida }, idExcluido = 0) {
  const [superpuestos] = await pool.query(
    `SELECT a.hora_entrada, a.hora_salida, s.nombre AS sede
       FROM agenda a
       JOIN sede s ON a.id_sede = s.id
      WHERE a.id_medico = ? AND a.fecha = ? AND a.id <> ?
        AND a.hora_entrada < ? AND a.hora_salida > ?
      LIMIT 1`,
    [id_medico, fecha, idExcluido, hora_salida, hora_entrada]
  );
  if (superpuestos.length > 0) {
    const { hora_entrada: entrada, hora_salida: salida, sede } = superpuestos[0];
    throw new ErrorHttp(
      409,
      `El médico ya tiene agenda ese día de ${entrada} a ${salida} en ${sede}: los rangos no se pueden superponer`
    );
  }
}

async function buscarTurnosConfirmados(idAgenda) {
  const [turnos] = await pool.query('SELECT id, hora FROM turno WHERE id_agenda = ? AND estado = ?', [
    idAgenda,
    ESTADO_CONFIRMADO,
  ]);
  return turnos;
}

// Ademas de los ids devuelve los nombres (medico, especialidad y sede) para que
// el front no tenga que resolverlos uno por uno.
export async function listarAgenda(filtros, usuario) {
  const condiciones = [];
  const valores = [];

  const idMedico = usuario.rol === 'medico' ? usuario.id : filtros.id_medico;
  if (idMedico) {
    condiciones.push('a.id_medico = ?');
    valores.push(idMedico);
  }
  if (filtros.id_sede) {
    condiciones.push('a.id_sede = ?');
    valores.push(filtros.id_sede);
  }
  if (filtros.fecha) {
    validarFormatoFecha(filtros.fecha);
    condiciones.push('a.fecha = ?');
    valores.push(filtros.fecha);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [registros] = await pool.query(
    `SELECT a.id, a.hora_entrada, a.hora_salida, DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha,
            a.id_medico, a.id_especialidad, a.id_sede,
            u.nombre AS nombre_medico, u.apellido AS apellido_medico,
            e.descripcion AS especialidad, s.nombre AS sede
       FROM agenda a
       JOIN usuario u ON a.id_medico = u.id
       JOIN especialidad e ON a.id_especialidad = e.id
       JOIN sede s ON a.id_sede = s.id
       ${where}
      ORDER BY a.fecha, a.hora_entrada`,
    valores
  );
  return registros;
}

export async function crearAgenda(datos, usuario) {
  validarCamposRequeridos(datos, CAMPOS_REQUERIDOS);
  validarFormatoAgenda(datos);
  const { hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede } = datos;
  validarPermisoAgenda(usuario, datos);
  await validarSinSuperposicion(datos);

  const [resultado] = await pool.query(
    'INSERT INTO agenda (hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede) VALUES (?, ?, ?, ?, ?, ?)',
    [hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede]
  );

  return { id: resultado.insertId, hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede };
}

export async function actualizarAgenda(id, datos, usuario) {
  validarCamposRequeridos(datos, CAMPOS_REQUERIDOS);
  validarFormatoAgenda(datos);
  const agenda = await buscarAgendaPorId(id);
  // Se valida contra el registro actual y contra los datos nuevos: un operador
  // no puede tocar agenda ajena ni mover la suya a otra sede.
  validarPermisoAgenda(usuario, agenda);
  validarPermisoAgenda(usuario, datos);
  const { hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede } = datos;

  // Ningun turno confirmado puede quedar fuera del nuevo horario. Si cambia la
  // fecha, el medico, la especialidad o la sede, todos quedarian afuera.
  const turnos = await buscarTurnosConfirmados(id);
  if (turnos.length > 0) {
    const cambiaAgenda =
      fecha !== agenda.fecha ||
      Number(id_medico) !== Number(agenda.id_medico) ||
      Number(id_especialidad) !== Number(agenda.id_especialidad) ||
      Number(id_sede) !== Number(agenda.id_sede);
    const horariosNuevos = generarHorarios(hora_entrada, hora_salida);
    const quedanAfuera = turnos.some((turno) => !horariosNuevos.includes(turno.hora));

    if (cambiaAgenda || quedanAfuera) {
      throw new ErrorHttp(
        409,
        'No se puede modificar el rango horario: dejaría turnos confirmados fuera del nuevo horario'
      );
    }
  }

  await validarSinSuperposicion(datos, id);

  await pool.query(
    'UPDATE agenda SET hora_entrada = ?, hora_salida = ?, fecha = ?, id_medico = ?, id_especialidad = ?, id_sede = ? WHERE id = ?',
    [hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede, id]
  );

  return { id: Number(id), hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede };
}

export async function eliminarAgenda(id, usuario) {
  const agenda = await buscarAgendaPorId(id);
  validarPermisoAgenda(usuario, agenda);

  const turnos = await buscarTurnosConfirmados(id);
  if (turnos.length > 0) {
    throw new ErrorHttp(409, 'No se puede eliminar el rango horario: tiene turnos confirmados');
  }

  await pool.query('DELETE FROM agenda WHERE id = ?', [id]);
  return { mensaje: 'Turno de agenda eliminado con éxito' };
}

function validarFiltrosDisponibilidad({ id_medico, id_especialidad, id_sede }) {
  validarEnteroPositivo(id_medico, 'id_medico');
  validarEnteroPositivo(id_especialidad, 'id_especialidad');
  validarEnteroPositivo(id_sede, 'id_sede');
}

// Fechas (de hoy en adelante) en las que el medico tiene agenda para esa
// especialidad y sede, y que todavia tienen al menos un horario libre (un dia
// con la agenda completa, o hoy con todos los horarios pasados, no se ofrece).
export async function fechasDisponibles(filtros) {
  validarFiltrosDisponibilidad(filtros);
  const { id_medico, id_especialidad, id_sede } = filtros;

  const [filas] = await pool.query(
    `SELECT DISTINCT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha
       FROM agenda
      WHERE id_medico = ? AND id_especialidad = ? AND id_sede = ? AND fecha >= ?
      ORDER BY fecha`,
    [id_medico, id_especialidad, id_sede, fechaDeHoy()]
  );

  const fechas = [];
  for (const { fecha } of filas) {
    const horarios = await horariosDisponibles({ ...filtros, fecha });
    if (horarios.length > 0) {
      fechas.push(fecha);
    }
  }
  return fechas;
}

// Horarios libres de un dia: los de las franjas de agenda menos los que ya
// tienen un turno confirmado. Solo devuelve horas, ningun dato de pacientes.
export async function horariosDisponibles(filtros) {
  validarFiltrosDisponibilidad(filtros);
  validarFormatoFecha(filtros.fecha);
  const { id_medico, id_especialidad, id_sede, fecha } = filtros;

  const [agendas] = await pool.query(
    `SELECT id, hora_entrada, hora_salida FROM agenda
      WHERE id_medico = ? AND id_especialidad = ? AND id_sede = ? AND fecha = ?`,
    [id_medico, id_especialidad, id_sede, fecha]
  );
  if (agendas.length === 0) {
    return [];
  }

  const [ocupados] = await pool.query(
    'SELECT hora FROM turno WHERE id_agenda IN (?) AND fecha = ? AND estado = ?',
    [agendas.map((agenda) => agenda.id), fecha, ESTADO_CONFIRMADO]
  );
  const horasOcupadas = ocupados.map((turno) => turno.hora);

  // Si es hoy, no se ofrecen los horarios que ya pasaron.
  const esHoy = fecha === fechaDeHoy();
  const ahora = horaActual();

  const libres = agendas
    .flatMap((agenda) => generarHorarios(agenda.hora_entrada, agenda.hora_salida))
    .filter((hora) => !horasOcupadas.includes(hora))
    .filter((hora) => !esHoy || hora > ahora);

  // Sin repetidos (dos franjas superpuestas) y en orden.
  return [...new Set(libres)].sort();
}
