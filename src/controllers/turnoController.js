import * as turnoService from '../services/turnoService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function crearTurno(req, res) {
  try {
    const resultado = await turnoService.crearTurno(req.body, req.usuario);
    return enviarRespuesta(res, 201, resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function cancelarTurno(req, res) {
  try {
    const resultado = await turnoService.cancelarTurno(req.params.id, req.usuario);
    return enviarRespuesta(res, 200, resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function atenderTurno(req, res) {
  try {
    const resultado = await turnoService.atenderTurno(req.params.id, req.body, req.usuario);
    return enviarRespuesta(res, 200, resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function misTurnos(req, res) {
  try {
    const turnos = await turnoService.misTurnos(req.usuario);
    return enviarRespuesta(res, 200, turnos);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function turnosProgramados(req, res) {
  try {
    const turnos = await turnoService.turnosProgramados(req.usuario, req.query.fecha);
    return enviarRespuesta(res, 200, turnos);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function turnosSede(req, res) {
  try {
    const turnos = await turnoService.turnosSede(req.usuario, req.query.fecha);
    return enviarRespuesta(res, 200, turnos);
  } catch (error) {
    return manejarError(res, error);
  }
}
