import * as sedeService from '../services/sedeService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function listarSedes(req, res) {
  try {
    const sedes = await sedeService.listarSedes();
    return enviarRespuesta(res, 200, sedes);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function crearSede(req, res) {
  try {
    const sede = await sedeService.crearSede(req.body);
    return enviarRespuesta(res, 201, sede);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function actualizarSede(req, res) {
  try {
    const sede = await sedeService.actualizarSede(req.params.id, req.body);
    return enviarRespuesta(res, 200, sede);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function eliminarSede(req, res) {
  try {
    const resultado = await sedeService.eliminarSede(req.params.id);
    return enviarRespuesta(res, 200, resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}
