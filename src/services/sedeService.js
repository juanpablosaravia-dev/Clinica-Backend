import pool from '../database/conexion.js';
import { ErrorHttp } from '../utils/errorHttp.js';

const CAMPOS_REQUERIDOS = ['nombre', 'direccion', 'telefono'];

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

async function buscarSedePorId(id) {
  const [sedes] = await pool.query(
    'SELECT id, nombre, direccion, telefono FROM sede WHERE id = ?',
    [id]
  );
  if (sedes.length === 0) {
    throw new ErrorHttp(404, 'Sede no encontrada');
  }
  return sedes[0];
}

export async function listarSedes() {
  const [sedes] = await pool.query('SELECT id, nombre, direccion, telefono FROM sede');
  return sedes;
}

export async function crearSede(datos) {
  validarCamposRequeridos(datos);
  const { nombre, direccion, telefono } = datos;

  const [resultado] = await pool.query(
    'INSERT INTO sede (nombre, direccion, telefono) VALUES (?, ?, ?)',
    [nombre, direccion, telefono]
  );

  return { id: resultado.insertId, nombre, direccion, telefono };
}

export async function actualizarSede(id, datos) {
  validarCamposRequeridos(datos);
  await buscarSedePorId(id);
  const { nombre, direccion, telefono } = datos;

  await pool.query('UPDATE sede SET nombre = ?, direccion = ?, telefono = ? WHERE id = ?', [
    nombre,
    direccion,
    telefono,
    id,
  ]);

  return { id: Number(id), nombre, direccion, telefono };
}

export async function eliminarSede(id) {
  await buscarSedePorId(id);

  const [usuariosAsociados] = await pool.query(
    "SELECT id FROM usuario WHERE id_sede = ? AND rol IN ('medico', 'operador') LIMIT 1",
    [id]
  );
  if (usuariosAsociados.length > 0) {
    throw new ErrorHttp(409, 'No se puede eliminar la sede: tiene médicos u operadores asociados');
  }

  const [agendaAsociada] = await pool.query('SELECT id FROM agenda WHERE id_sede = ? LIMIT 1', [
    id,
  ]);
  if (agendaAsociada.length > 0) {
    throw new ErrorHttp(409, 'No se puede eliminar la sede: tiene agenda asociada');
  }

  await pool.query('DELETE FROM sede WHERE id = ?', [id]);
  return { mensaje: 'Sede eliminada con éxito' };
}
