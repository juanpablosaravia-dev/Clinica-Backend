import { enviarRespuesta } from '../utils/respuesta.js';

// Fábrica de middlewares: verificarRol('admin', 'operador') devuelve el
// middleware que Express ejecuta. Debe montarse SIEMPRE después de
// verificarToken, que es quien completa req.usuario.
export function verificarRol(...rolesPermitidos) {
  return function (req, res, next) {
    if (!req.usuario) {
      // Red de seguridad: la ruta se armó sin verificarToken delante.
      return enviarRespuesta(res, 401, null, 'Token no proporcionado');
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return enviarRespuesta(res, 403, null, 'No tenés permisos para acceder a este recurso');
    }

    return next();
  };
}

export default verificarRol;
