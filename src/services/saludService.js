import pool from '../database/conexion.js';

export async function verificarConexionBd() {
  await pool.query('SELECT 1');
  return {
    mensaje: 'Conexión a la base de datos exitosa',
    timestamp: new Date().toISOString(),
  };
}
