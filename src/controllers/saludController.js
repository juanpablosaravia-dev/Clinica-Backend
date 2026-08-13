import pool from '../database/conexion.js';
import { enviarRespuesta } from '../utils/respuesta.js';

export async function verificarSalud(req, res) {
  try {
    await pool.query('SELECT 1');
    return enviarRespuesta(res, 200, {
      mensaje: 'Conexión a la base de datos exitosa',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return enviarRespuesta(res, 500, null, 'Error de conexión a la base de datos');
  }
}
