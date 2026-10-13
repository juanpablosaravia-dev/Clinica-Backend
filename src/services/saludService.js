import pool from '../database/conexion.js';
import { ErrorHttp } from '../utils/errorHttp.js';

export async function verificarConexionBd() {
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    // Este endpoint existe justamente para reportar el estado de la base, asi
    // que conviene el mensaje especifico y no el 500 generico. El detalle real
    // del driver se loguea aca, porque no viaja en la respuesta.
    console.error('Falló la verificación de conexión a la base:', error);
    throw new ErrorHttp(500, 'Error de conexión a la base de datos');
  }

  return {
    mensaje: 'Conexión a la base de datos exitosa',
    timestamp: new Date().toISOString(),
  };
}
