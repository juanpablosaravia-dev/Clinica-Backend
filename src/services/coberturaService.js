import pool from '../database/conexion.js';
import { ErrorHttp } from '../utils/errorHttp.js';
import { validarCamposRequeridos } from '../utils/validaciones.js';

const CAMPOS_REQUERIDOS = ['nombre'];

async function buscarCoberturaPorId(id) {
  const [coberturas] = await pool.query('SELECT id, nombre FROM cobertura WHERE id = ?', [id]);
  if (coberturas.length === 0) {
    throw new ErrorHttp(404, 'Cobertura no encontrada');
  }
  return coberturas[0];
}

export async function listarCoberturas() {
  const [coberturas] = await pool.query('SELECT id, nombre FROM cobertura');
  return coberturas;
}

export async function crearCobertura(datos) {
  validarCamposRequeridos(datos, CAMPOS_REQUERIDOS);
  const { nombre } = datos;

  const [resultado] = await pool.query('INSERT INTO cobertura (nombre) VALUES (?)', [nombre]);

  return { id: resultado.insertId, nombre };
}

export async function actualizarCobertura(id, datos) {
  validarCamposRequeridos(datos, CAMPOS_REQUERIDOS);
  await buscarCoberturaPorId(id);
  const { nombre } = datos;

  await pool.query('UPDATE cobertura SET nombre = ? WHERE id = ?', [nombre, id]);

  return { id: Number(id), nombre };
}

export async function eliminarCobertura(id) {
  await buscarCoberturaPorId(id);

  const [usuariosAsociados] = await pool.query(
    'SELECT id FROM usuario WHERE id_cobertura = ? LIMIT 1',
    [id]
  );
  if (usuariosAsociados.length > 0) {
    throw new ErrorHttp(409, 'No se puede eliminar la cobertura: tiene usuarios asociados');
  }

  await pool.query('DELETE FROM cobertura WHERE id = ?', [id]);
  return { mensaje: 'Cobertura eliminada con éxito' };
}
