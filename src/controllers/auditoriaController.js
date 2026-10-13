import * as auditoriaService from '../services/auditoriaService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function listarLogs(req, res) {
  try {
    const logs = await auditoriaService.listarLogs(req.query);
    return enviarRespuesta(res, 200, logs);
  } catch (error) {
    return manejarError(res, error);
  }
}
