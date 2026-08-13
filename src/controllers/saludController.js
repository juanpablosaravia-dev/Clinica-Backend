import { verificarConexionBd } from '../services/saludService.js';
import { enviarRespuesta } from '../utils/respuesta.js';

export async function verificarSalud(req, res) {
  try {
    const estadoBd = await verificarConexionBd();
    return enviarRespuesta(res, 200, estadoBd);
  } catch (error) {
    return enviarRespuesta(res, 500, null, 'Error de conexión a la base de datos');
  }
}
