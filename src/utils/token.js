import jwt from 'jsonwebtoken';

const VIGENCIA_POR_DEFECTO = '2h';

// Se lee en cada llamada (y no una sola vez al importar el módulo) para que el
// orden de imports no importe: index.js carga 'dotenv/config' antes de arrancar.
function obtenerSecreto() {
  const secreto = process.env.JWT_SECRET;
  if (!secreto) {
    throw new Error('Falta la variable de entorno JWT_SECRET');
  }
  return secreto;
}

export function firmarToken(payload) {
  return jwt.sign(payload, obtenerSecreto(), {
    expiresIn: process.env.JWT_EXPIRES_IN || VIGENCIA_POR_DEFECTO,
  });
}

// Devuelve el payload decodificado o lanza el error de jsonwebtoken
// (TokenExpiredError, JsonWebTokenError) para que lo clasifique el middleware.
export function verificarTokenJwt(token) {
  return jwt.verify(token, obtenerSecreto());
}
