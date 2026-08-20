import * as coberturaService from '../services/coberturaService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function obtenerCoberturas(req, res) {
  try {
    const coberturas = await coberturaService.listarCoberturas();
    return enviarRespuesta(res, 200, coberturas);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function crearCobertura(req, res) {
  try {
    const cobertura = await coberturaService.crearCobertura(req.body);
    return enviarRespuesta(res, 201, cobertura);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function actualizarCobertura(req, res) {
  try {
    const cobertura = await coberturaService.actualizarCobertura(req.params.id, req.body);
    return enviarRespuesta(res, 200, cobertura);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function eliminarCobertura(req, res) {
  try {
    const resultado = await coberturaService.eliminarCobertura(req.params.id);
    return enviarRespuesta(res, 200, resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}
