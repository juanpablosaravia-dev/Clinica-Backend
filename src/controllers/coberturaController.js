import pool from '../database/conexion.js';
import { enviarRespuesta } from '../utils/respuesta.js';

export async function obtenerCoberturas(req, res) {
  try {
    const [coberturas] = await pool.query('SELECT id, nombre FROM cobertura');
    return enviarRespuesta(res, 200, coberturas);
  } catch (error) {
    return enviarRespuesta(res, 500, null, 'Error al obtener las coberturas');
  }
}
