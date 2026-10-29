import * as usuarioService from '../services/usuarioService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function listarUsuarios(req, res) {
  try {
    const usuarios = await usuarioService.listarUsuarios();
    return enviarRespuesta(res, 200, usuarios);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function crearUsuario(req, res) {
  try {
    const usuario = await usuarioService.crearUsuario(req.body);
    return enviarRespuesta(res, 201, usuario);
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function actualizarUsuario(req, res) {
  try {
    const usuario = await usuarioService.actualizarUsuario(req.params.id, req.body);
    return enviarRespuesta(res, 200, usuario);
  } catch (error) {
    return manejarError(res, error);
  }
}
