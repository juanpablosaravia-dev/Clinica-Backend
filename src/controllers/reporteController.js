import * as reporteService from '../services/reporteService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function turnosPorEspecialidad(req, res) {
  try {
    const reporte = await reporteService.turnosPorEspecialidad(req.query);
    return enviarRespuesta(res, 200, reporte);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function turnosPorSede(req, res) {
  try {
    const reporte = await reporteService.turnosPorSede(req.query);
    return enviarRespuesta(res, 200, reporte);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function rankingMedicos(req, res) {
  try {
    const reporte = await reporteService.rankingMedicos(req.query);
    return enviarRespuesta(res, 200, reporte);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function tasaCancelacion(req, res) {
  try {
    const reporte = await reporteService.tasaCancelacion(req.query);
    return enviarRespuesta(res, 200, reporte);
  } catch (error) {
    return manejarError(res, error);
  }
}
