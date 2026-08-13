import * as authService from '../services/authService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { ErrorHttp } from '../utils/errorHttp.js';

function manejarError(res, error) {
  if (error instanceof ErrorHttp) {
    return enviarRespuesta(res, error.codigo, null, error.message);
  }
  return enviarRespuesta(res, 500, null, 'Error interno del servidor');
}

export async function registrarPaciente(req, res) {
  try {
    const resultado = await authService.registrarPaciente(req.body);
    return enviarRespuesta(res, 201, resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function iniciarSesion(req, res) {
  try {
    const resultado = await authService.iniciarSesion(req.body);
    return enviarRespuesta(res, 200, resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}

// Endpoint de prueba de verificarToken: usa el id que el middleware dejó en req.usuario.
export async function obtenerPerfil(req, res) {
  try {
    const perfil = await authService.obtenerPerfil(req.usuario.id);
    return enviarRespuesta(res, 200, perfil);
  } catch (error) {
    return manejarError(res, error);
  }
}

// Endpoint de prueba de verificarRol: sólo se alcanza con rol 'admin'.
// No hay lógica de negocio que extraer, solo eco del usuario autenticado.
export function verificarAccesoAdmin(req, res) {
  return enviarRespuesta(res, 200, {
    mensaje: 'Acceso administrativo concedido',
    id: req.usuario.id,
    rol: req.usuario.rol,
  });
}
