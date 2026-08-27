import * as notificacionService from '../services/notificacionService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function listarNotificaciones(req, res) {
  try {
    const notificaciones = await notificacionService.listarNotificaciones(req.usuario.id);
    return enviarRespuesta(res, 200, notificaciones);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function marcarNotificacionLeida(req, res) {
  try {
    const notificacion = await notificacionService.marcarNotificacionLeida(req.params.id, req.usuario);
    return enviarRespuesta(res, 200, notificacion);
  } catch (error) {
    return manejarError(res, error);
  }
}
