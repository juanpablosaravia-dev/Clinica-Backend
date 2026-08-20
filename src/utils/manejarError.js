import { enviarRespuesta } from './respuesta.js';
import { ErrorHttp } from './errorHttp.js';

export function manejarError(res, error) {
  if (error instanceof ErrorHttp) {
    return enviarRespuesta(res, error.codigo, null, error.message);
  }
  return enviarRespuesta(res, 500, null, 'Error interno del servidor');
}
