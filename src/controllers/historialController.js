import * as historialService from '../services/historialService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function registrarHistorial(req, res) {
  try {
    const historial = await historialService.registrarHistorial(req.body, req.usuario);
    return enviarRespuesta(res, 201, historial);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function historialDePaciente(req, res) {
  try {
    const registros = await historialService.historialDePaciente(req.params.idPaciente, req.usuario);
    return enviarRespuesta(res, 200, registros);
  } catch (error) {
    return manejarError(res, error);
  }
}
