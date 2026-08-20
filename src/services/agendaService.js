import pool from '../database/conexion.js';
import { ErrorHttp } from '../utils/errorHttp.js';

const CAMPOS_REQUERIDOS = ['hora_entrada', 'hora_salida', 'fecha', 'id_medico', 'id_especialidad', 'id_sede'];

function buscarCamposFaltantes(cuerpo, camposRequeridos) {
  const datos = cuerpo ?? {};
  return camposRequeridos.filter((campo) => {
    const valor = datos[campo];
    return valor === undefined || valor === null || valor === '';
  });
}

function validarCamposRequeridos(cuerpo) {
  const camposFaltantes = buscarCamposFaltantes(cuerpo, CAMPOS_REQUERIDOS);
  if (camposFaltantes.length > 0) {
    throw new ErrorHttp(400, `Faltan campos requeridos: ${camposFaltantes.join(', ')}`);
  }
}

// El rol medico solo puede gestionar su propia agenda; el operador puede
// gestionar la de cualquier medico y sede.
function validarPropiedadAgenda(usuario, idMedico) {
  if (usuario.rol === 'medico' && Number(idMedico) !== Number(usuario.id)) {
    throw new ErrorHttp(403, 'Un médico solo puede gestionar su propia agenda');
  }
}

async function buscarAgendaPorId(id) {
  const [registros] = await pool.query(
    'SELECT id, hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede FROM agenda WHERE id = ?',
    [id]
  );
  if (registros.length === 0) {
    throw new ErrorHttp(404, 'Turno de agenda no encontrado');
  }
  return registros[0];
}

export async function listarAgenda(filtros, usuario) {
  const condiciones = [];
  const valores = [];

  const idMedico = usuario.rol === 'medico' ? usuario.id : filtros.id_medico;
  if (idMedico) {
    condiciones.push('id_medico = ?');
    valores.push(idMedico);
  }
  if (filtros.id_sede) {
    condiciones.push('id_sede = ?');
    valores.push(filtros.id_sede);
  }
  if (filtros.fecha) {
    condiciones.push('fecha = ?');
    valores.push(filtros.fecha);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [registros] = await pool.query(
    `SELECT id, hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede FROM agenda ${where}`,
    valores
  );
  return registros;
}

export async function crearAgenda(datos, usuario) {
  validarCamposRequeridos(datos);
  const { hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede } = datos;
  validarPropiedadAgenda(usuario, id_medico);

  const [resultado] = await pool.query(
    'INSERT INTO agenda (hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede) VALUES (?, ?, ?, ?, ?, ?)',
    [hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede]
  );

  return { id: resultado.insertId, hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede };
}

export async function actualizarAgenda(id, datos, usuario) {
  validarCamposRequeridos(datos);
  const agenda = await buscarAgendaPorId(id);
  validarPropiedadAgenda(usuario, agenda.id_medico);
  const { hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede } = datos;
  validarPropiedadAgenda(usuario, id_medico);

  await pool.query(
    'UPDATE agenda SET hora_entrada = ?, hora_salida = ?, fecha = ?, id_medico = ?, id_especialidad = ?, id_sede = ? WHERE id = ?',
    [hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede, id]
  );

  return { id: Number(id), hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede };
}

export async function eliminarAgenda(id, usuario) {
  const agenda = await buscarAgendaPorId(id);
  validarPropiedadAgenda(usuario, agenda.id_medico);

  await pool.query('DELETE FROM agenda WHERE id = ?', [id]);
  return { mensaje: 'Turno de agenda eliminado con éxito' };
}
