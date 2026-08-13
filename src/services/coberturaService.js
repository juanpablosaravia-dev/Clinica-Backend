import pool from '../database/conexion.js';

export async function listarCoberturas() {
  const [coberturas] = await pool.query('SELECT id, nombre FROM cobertura');
  return coberturas;
}
