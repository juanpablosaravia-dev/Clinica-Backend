import * as especialidadService from '../services/especialidadService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function listarEspecialidades(req, res) {
  try {
    const especialidades = await especialidadService.listarEspecialidades();
    return enviarRespuesta(res, 200, especialidades);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function crearEspecialidad(req, res) {
  try {
    const especialidad = await especialidadService.crearEspecialidad(req.body);
    return enviarRespuesta(res, 201, especialidad);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function actualizarEspecialidad(req, res) {
  try {
    const especialidad = await especialidadService.actualizarEspecialidad(
      req.params.id,
      req.body
    );
    return enviarRespuesta(res, 200, especialidad);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function eliminarEspecialidad(req, res) {
  try {
    const resultado = await especialidadService.eliminarEspecialidad(req.params.id);
    return enviarRespuesta(res, 200, resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}
