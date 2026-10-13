import { verificarConexionBd } from '../services/saludService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function verificarSalud(req, res) {
  try {
    const estadoBd = await verificarConexionBd();
    return enviarRespuesta(res, 200, estadoBd);
  } catch (error) {
    return manejarError(res, error);
  }
}
