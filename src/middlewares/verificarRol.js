import { enviarRespuesta } from '../utils/respuesta.js';

// Debe usarse siempre después de verificarToken: lee el rol que quedó en
// req.usuario (payload del JWT) y corta con 403 si no está permitido.
export function verificarRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.usuario?.rol)) {
      return enviarRespuesta(res, 403, null, 'No tiene permisos para acceder a este recurso');
    }
    return next();
  };
}

export default verificarRol;
