import {
  registrarLog,
  ACCION_ALTA,
  ACCION_BAJA,
  ACCION_MODIFICACION,
} from '../services/auditoriaService.js';

const ACCION_POR_METODO = {
  POST: ACCION_ALTA,
  PUT: ACCION_MODIFICACION,
  DELETE: ACCION_BAJA,
};

// En el alta el id recien se conoce cuando el controlador respondio (viene en
// datos.id); en modificacion y baja ya venia en la URL.
function obtenerIdEntidad(req, cuerpo) {
  if (req.method === 'POST') {
    return cuerpo?.datos?.id ?? null;
  }
  return req.params.id ?? null;
}

// Un middleware por entidad (`auditar('sede')`) para que el log quede escrito
// en un solo lugar y no haya que repetirlo en cada controlador.
//
// El log se escribe envolviendo res.json: asi se ejecuta recien despues de que
// el controlador respondio y se puede mirar el codigo de estado real, en lugar
// de auditar intentos que terminaron en 400/403/409.
export function auditar(entidad) {
  return (req, res, next) => {
    const accion = ACCION_POR_METODO[req.method];
    // Las consultas (GET) no son acciones sensibles: no se auditan.
    if (!accion) {
      return next();
    }

    const enviarJson = res.json.bind(res);

    res.json = (cuerpo) => {
      const salioBien = res.statusCode >= 200 && res.statusCode < 300;
      // En el registro publico de pacientes no hay token, asi que el autor es
      // el propio usuario que se acaba de crear.
      const idUsuario = req.usuario?.id ?? cuerpo?.datos?.id;

      if (salioBien && idUsuario) {
        registrarLog({
          id_usuario: idUsuario,
          accion,
          entidad,
          id_entidad: obtenerIdEntidad(req, cuerpo),
          detalle: `${accion} de ${entidad} vía ${req.method} ${req.originalUrl}`,
        }).catch((error) => {
          // El log es un registro secundario: si falla, no puede tumbar una
          // operacion que para el cliente ya termino bien.
          console.error('No se pudo registrar el log de auditoría:', error.message);
        });
      }

      return enviarJson(cuerpo);
    };

    return next();
  };
}

export default auditar;
