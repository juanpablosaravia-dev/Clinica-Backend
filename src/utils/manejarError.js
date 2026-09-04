import { enviarRespuesta } from './respuesta.js';
import { ErrorHttp } from './errorHttp.js';

export function manejarError(res, error) {
  if (error instanceof ErrorHttp) {
    return enviarRespuesta(res, error.codigo, null, error.message);
  }
  // Lo que llega hasta aca no es un fallo de negocio previsto sino un bug o una
  // caida de la base. Al cliente se le responde siempre lo mismo (no se filtran
  // detalles internos), pero sin este log el 500 no deja ningun rastro y queda
  // imposible de diagnosticar.
  console.error('Error inesperado:', error);
  return enviarRespuesta(res, 500, null, 'Error interno del servidor');
}
