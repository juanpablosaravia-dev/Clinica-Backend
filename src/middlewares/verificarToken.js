import { verificarTokenJwt } from '../utils/token.js';
import { enviarRespuesta } from '../utils/respuesta.js';

const PREFIJO_BEARER = 'Bearer ';

// Valida el JWT del header Authorization. Si es válido y no está vencido deja
// el payload ({ id, rol, id_sede }) en req.usuario; si no, corta con 401.
export function verificarToken(req, res, next) {
  const encabezado = req.headers.authorization;

  if (!encabezado || !encabezado.startsWith(PREFIJO_BEARER)) {
    return enviarRespuesta(res, 401, null, 'Token no proporcionado');
  }

  const token = encabezado.slice(PREFIJO_BEARER.length).trim();
  if (token === '') {
    return enviarRespuesta(res, 401, null, 'Token no proporcionado');
  }

  try {
    req.usuario = verificarTokenJwt(token);
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return enviarRespuesta(res, 401, null, 'Token expirado');
    }
    if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
      return enviarRespuesta(res, 401, null, 'Token inválido');
    }
    // Cualquier otra causa (por ejemplo, JWT_SECRET sin definir) es un problema
    // del servidor, no de las credenciales que mandó el cliente.
    return enviarRespuesta(res, 500, null, 'Error interno del servidor');
  }
}

export default verificarToken;
