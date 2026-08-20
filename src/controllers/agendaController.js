import * as agendaService from '../services/agendaService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function listarAgenda(req, res) {
  try {
    const registros = await agendaService.listarAgenda(req.query, req.usuario);
    return enviarRespuesta(res, 200, registros);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function crearAgenda(req, res) {
  try {
    const agenda = await agendaService.crearAgenda(req.body, req.usuario);
    return enviarRespuesta(res, 201, agenda);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function actualizarAgenda(req, res) {
  try {
    const agenda = await agendaService.actualizarAgenda(req.params.id, req.body, req.usuario);
    return enviarRespuesta(res, 200, agenda);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function eliminarAgenda(req, res) {
  try {
    const resultado = await agendaService.eliminarAgenda(req.params.id, req.usuario);
    return enviarRespuesta(res, 200, resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}
