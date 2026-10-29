import * as medicoService from '../services/medicoService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function listarMedicos(req, res) {
  try {
    const medicos = await medicoService.listarMedicos(req.query);
    return enviarRespuesta(res, 200, medicos);
  } catch (error) {
    return manejarError(res, error);
  }
}
