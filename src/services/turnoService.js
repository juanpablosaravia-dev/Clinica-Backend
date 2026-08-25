import pool from '../database/conexion.js';
import { ErrorHttp } from '../utils/errorHttp.js';
import { ejecutarEnTransaccion } from '../database/transaccion.js';
import {
  validarCamposRequeridos,
  validarFormatoFecha,
  validarFormatoHora,
  validarLargoMaximo,
  horaEnRango,
} from '../utils/validaciones.js';
import {
  crearNotificacion,
  formatearFechaHumana,
  TIPO_TURNO_CONFIRMADO,
  TIPO_TURNO_CANCELADO,
  TIPO_TURNO_ATENDIDO,
} from './notificacionService.js';

const CAMPOS_REQUERIDOS_TURNO = ['id_especialidad', 'id_sede', 'id_medico', 'fecha', 'hora', 'nota'];

const LARGO_MAXIMO_NOTA = 40; // turno.nota es varchar(40)
const LARGO_MAXIMO_TEXTO_HISTORIAL = 255; // las columnas de texto de historial_clinico son varchar(255)

const ESTADO_CONFIRMADO = 'confirmado';
const ESTADO_CANCELADO = 'cancelado';
const ESTADO_ATENDIDO = 'atendido';

const ROL_PACIENTE = 'paciente';
const ROL_OPERADOR = 'operador';

// turno no tiene id_sede ni id_medico propios: viven en agenda. Por eso toda
// lectura de un turno se hace con este JOIN, y de ahí salen los datos con los
// que después se decide el acceso por sede o por médico.
//
// El DATE_FORMAT es deliberado: sin él, mysql2 devuelve la columna DATE como un
// Date de JS y la respuesta sale como '2026-09-01T03:00:00.000Z', con riesgo de
// correrse un día según el huso horario del servidor.
async function buscarTurnoConAgenda(id, conexion = pool, bloquear = false) {
  const [turnos] = await conexion.query(
    `SELECT t.id, t.nota, t.id_agenda, DATE_FORMAT(t.fecha, '%Y-%m-%d') AS fecha, t.hora,
            t.id_paciente, t.id_cobertura, t.estado,
            a.id_medico, a.id_sede, a.id_especialidad
       FROM turno t
       JOIN agenda a ON t.id_agenda = a.id
      WHERE t.id = ?${bloquear ? ' FOR UPDATE' : ''}`,
    [id]
  );

  if (turnos.length === 0) {
    throw new ErrorHttp(404, 'Turno no encontrado');
  }
  return turnos[0];
}

// El paciente solo alcanza sus propios turnos; operador y médico, únicamente los
// de su sede (la sede del turno sale del JOIN con agenda).
function validarAccesoTurno(turno, usuario) {
  if (usuario.rol === ROL_PACIENTE) {
    if (Number(turno.id_paciente) !== Number(usuario.id)) {
      throw new ErrorHttp(403, 'Un paciente solo puede cancelar sus propios turnos');
    }
    return;
  }

  if (usuario.id_sede === null || usuario.id_sede === undefined) {
    throw new ErrorHttp(403, 'El usuario no tiene una sede asignada');
  }
  if (Number(turno.id_sede) !== Number(usuario.id_sede)) {
    throw new ErrorHttp(403, 'Solo puede operar sobre turnos de su propia sede');
  }
}

// La cobertura del turno se toma siempre de la ficha del paciente. Este es el
// único lugar del que sale, para que no pueda pisarse desde el body.
async function buscarPacienteConCobertura(idPaciente) {
  const [usuarios] = await pool.query('SELECT id, rol, id_cobertura FROM usuario WHERE id = ?', [
    idPaciente,
  ]);

  if (usuarios.length === 0) {
    throw new ErrorHttp(400, 'El paciente indicado no existe');
  }

  const paciente = usuarios[0];
  if (paciente.rol !== ROL_PACIENTE) {
    throw new ErrorHttp(400, 'El usuario indicado no es un paciente');
  }
  if (paciente.id_cobertura === null) {
    throw new ErrorHttp(400, 'El paciente no tiene una cobertura registrada');
  }
  return paciente;
}

// El body identifica el turno por especialidad, sede, médico, fecha y hora, pero
// la tabla guarda id_agenda: hay que encontrar la franja que corresponde.
async function resolverAgenda({ id_medico, id_especialidad, id_sede, fecha, hora }, conexion) {
  const [agendas] = await conexion.query(
    `SELECT id, hora_entrada, hora_salida, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
            id_medico, id_especialidad, id_sede
       FROM agenda
      WHERE id_medico = ? AND id_especialidad = ? AND id_sede = ? AND fecha = ?`,
    [id_medico, id_especialidad, id_sede, fecha]
  );

  if (agendas.length === 0) {
    throw new ErrorHttp(400, 'No hay agenda del médico indicado para esa especialidad, sede y fecha');
  }

  // Un médico puede tener más de una franja el mismo día (mañana y tarde), así
  // que no alcanza con tomar la primera: hay que quedarse con la que realmente
  // cubre la hora pedida.
  const agenda = agendas.find((franja) => horaEnRango(hora, franja.hora_entrada, franja.hora_salida));
  if (!agenda) {
    throw new ErrorHttp(400, 'La hora solicitada está fuera del horario de atención del médico');
  }
  return agenda;
}

export async function crearTurno(datos, usuario) {
  const esOperador = usuario.rol === ROL_OPERADOR;

  // Cuando lo pide un operador, id_paciente pasa a ser obligatorio; cuando lo
  // pide el paciente, se ignora y se usa el id del token.
  validarCamposRequeridos(
    datos,
    esOperador ? [...CAMPOS_REQUERIDOS_TURNO, 'id_paciente'] : CAMPOS_REQUERIDOS_TURNO
  );

  const { id_medico, id_especialidad, id_sede, fecha, hora, nota } = datos;
  validarFormatoFecha(fecha);
  validarFormatoHora(hora);
  validarLargoMaximo(nota, LARGO_MAXIMO_NOTA, 'nota');

  // Misma regla que en la cancelación: el operador no opera fuera de su sede.
  // Sin esto podría crear un turno que después no podría cancelar. Se chequea
  // antes de buscar la agenda para no revelar, con el mensaje de error, si esa
  // otra sede tiene o no agenda para ese médico y fecha.
  if (esOperador && Number(id_sede) !== Number(usuario.id_sede)) {
    throw new ErrorHttp(403, 'Solo puede operar sobre turnos de su propia sede');
  }

  const idPaciente = esOperador ? datos.id_paciente : usuario.id;
  // datos.id_cobertura ni se lee: la cobertura sale de la ficha del paciente.
  const paciente = await buscarPacienteConCobertura(idPaciente);

  return ejecutarEnTransaccion(async (conexion) => {
    const agenda = await resolverAgenda({ id_medico, id_especialidad, id_sede, fecha, hora }, conexion);

    // Candado sobre la fila de la agenda: serializa las altas concurrentes. Sin
    // él, dos requests simultáneos pueden pasar juntos el chequeo de ocupación
    // de abajo y terminar creando dos turnos confirmados en el mismo horario.
    await conexion.query('SELECT id FROM agenda WHERE id = ? FOR UPDATE', [agenda.id]);

    const [ocupados] = await conexion.query(
      'SELECT id FROM turno WHERE id_agenda = ? AND fecha = ? AND hora = ? AND estado = ? LIMIT 1',
      [agenda.id, agenda.fecha, hora, ESTADO_CONFIRMADO]
    );
    if (ocupados.length > 0) {
      throw new ErrorHttp(409, 'El horario solicitado ya está ocupado');
    }

    // La fecha se toma de la agenda y no del body: ya validamos que coinciden, y
    // así turno.fecha y agenda.fecha no pueden divergir.
    const [resultado] = await conexion.query(
      `INSERT INTO turno (nota, id_agenda, fecha, hora, id_paciente, id_cobertura, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nota, agenda.id, agenda.fecha, hora, paciente.id, paciente.id_cobertura, ESTADO_CONFIRMADO]
    );

    const turno = {
      id: resultado.insertId,
      nota,
      id_agenda: agenda.id,
      fecha: agenda.fecha,
      hora,
      id_paciente: paciente.id,
      id_cobertura: paciente.id_cobertura,
      estado: ESTADO_CONFIRMADO,
      id_medico: agenda.id_medico,
      id_especialidad: agenda.id_especialidad,
      id_sede: agenda.id_sede,
    };

    const notificacion = await crearNotificacion(
      {
        id_usuario: paciente.id,
        tipo: TIPO_TURNO_CONFIRMADO,
        mensaje: `Tu turno del ${formatearFechaHumana(turno.fecha)} a las ${turno.hora} fue confirmado.`,
      },
      conexion
    );

    return { turno, notificaciones: [notificacion] };
  });
}

export async function cancelarTurno(id, usuario) {
  return ejecutarEnTransaccion(async (conexion) => {
    const turno = await buscarTurnoConAgenda(id, conexion, true);

    // Primero el acceso y después la transición: así un paciente que intenta
    // cancelar un turno ajeno recibe 403 y no se entera del estado de ese turno.
    validarAccesoTurno(turno, usuario);

    if (turno.estado === ESTADO_CANCELADO) {
      throw new ErrorHttp(409, 'El turno ya se encuentra cancelado');
    }
    if (turno.estado === ESTADO_ATENDIDO) {
      throw new ErrorHttp(409, 'No se puede cancelar un turno que ya fue atendido');
    }

    await conexion.query('UPDATE turno SET estado = ? WHERE id = ?', [ESTADO_CANCELADO, turno.id]);

    const cuando = `${formatearFechaHumana(turno.fecha)} a las ${turno.hora}`;
    // El tipo describe el evento, no al destinatario: la del médico también es
    // 'turno_cancelado'.
    const notificaciones = [
      await crearNotificacion(
        {
          id_usuario: turno.id_paciente,
          tipo: TIPO_TURNO_CANCELADO,
          mensaje: `Tu turno del ${cuando} fue cancelado.`,
        },
        conexion
      ),
      await crearNotificacion(
        {
          id_usuario: turno.id_medico,
          tipo: TIPO_TURNO_CANCELADO,
          mensaje: `Se canceló el turno del ${cuando} de tu agenda.`,
        },
        conexion
      ),
    ];

    return { turno: { ...turno, estado: ESTADO_CANCELADO }, notificaciones };
  });
}

export async function atenderTurno(id, datos, usuario) {
  const { diagnostico, tratamiento, observaciones } = datos ?? {};

  // El historial es opcional: si el médico manda diagnóstico se carga en el
  // mismo movimiento, y si no queda para un paso posterior.
  const registraHistorial = diagnostico !== undefined && diagnostico !== null && diagnostico !== '';

  if (registraHistorial) {
    validarLargoMaximo(diagnostico, LARGO_MAXIMO_TEXTO_HISTORIAL, 'diagnóstico');
    validarLargoMaximo(tratamiento, LARGO_MAXIMO_TEXTO_HISTORIAL, 'tratamiento');
    validarLargoMaximo(observaciones, LARGO_MAXIMO_TEXTO_HISTORIAL, 'observaciones');
  }

  return ejecutarEnTransaccion(async (conexion) => {
    const turno = await buscarTurnoConAgenda(id, conexion, true);

    if (Number(turno.id_medico) !== Number(usuario.id)) {
      throw new ErrorHttp(403, 'Un médico solo puede atender turnos de su propia agenda');
    }
    if (turno.estado === ESTADO_ATENDIDO) {
      throw new ErrorHttp(409, 'El turno ya se encuentra atendido');
    }
    if (turno.estado !== ESTADO_CONFIRMADO) {
      throw new ErrorHttp(409, 'No se puede atender un turno cancelado');
    }

    await conexion.query('UPDATE turno SET estado = ? WHERE id = ?', [ESTADO_ATENDIDO, turno.id]);

    // El turno y su historial quedan asociados por historial_clinico.id_turno, y
    // ambas escrituras viven en la misma transacción: o quedan las dos o ninguna.
    let historial = null;
    if (registraHistorial) {
      const [resultado] = await conexion.query(
        `INSERT INTO historial_clinico (id_turno, id_medico, id_paciente, diagnostico, tratamiento, observaciones)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          turno.id,
          turno.id_medico,
          turno.id_paciente,
          diagnostico,
          tratamiento ?? null,
          observaciones ?? null,
        ]
      );

      historial = {
        id: resultado.insertId,
        id_turno: turno.id,
        id_medico: turno.id_medico,
        id_paciente: turno.id_paciente,
        diagnostico,
        tratamiento: tratamiento ?? null,
        observaciones: observaciones ?? null,
      };
    }

    const notificacion = await crearNotificacion(
      {
        id_usuario: turno.id_paciente,
        tipo: TIPO_TURNO_ATENDIDO,
        mensaje: `Tu turno del ${formatearFechaHumana(turno.fecha)} a las ${turno.hora} fue registrado como atendido.`,
      },
      conexion
    );

    return {
      turno: { ...turno, estado: ESTADO_ATENDIDO },
      historial,
      notificaciones: [notificacion],
    };
  });
}
