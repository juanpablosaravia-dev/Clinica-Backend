import pool from '../database/conexion.js';

export const TIPO_TURNO_CONFIRMADO = 'turno_confirmado';
export const TIPO_TURNO_CANCELADO = 'turno_cancelado';
export const TIPO_TURNO_ATENDIDO = 'turno_atendido';

const LARGO_MAXIMO_MENSAJE = 255; // notificacion.mensaje es varchar(255)

// Las notificaciones no tienen endpoint de alta: se generan internamente desde
// los flujos de turno. El parametro `conexion` permite que el INSERT participe
// de la transaccion del llamador; si no se pasa, cae al pool y se comporta como
// una query suelta (pool y PoolConnection exponen la misma interfaz .query()).
export async function crearNotificacion({ id_usuario, tipo, mensaje }, conexion = pool) {
  // Sin este recorte, un mensaje largo dispara ER_DATA_TOO_LONG y termina en un
  // 500, que es justamente lo que la consigna prohibe.
  const mensajeRecortado = String(mensaje).slice(0, LARGO_MAXIMO_MENSAJE);

  const [resultado] = await conexion.query(
    'INSERT INTO notificacion (id_usuario, tipo, mensaje, leida) VALUES (?, ?, ?, 0)',
    [id_usuario, tipo, mensajeRecortado]
  );

  return { id: resultado.insertId, id_usuario, tipo, mensaje: mensajeRecortado, leida: 0 };
}

// '2026-09-02' -> '02/09/2026', para replicar el formato de mensaje que ya usa
// el seed del script SQL: 'Tu turno del 27/10/2025 a las 15:30 fue confirmado.'
export function formatearFechaHumana(fechaIso) {
  const [anio, mes, dia] = String(fechaIso).split('-');
  return `${dia}/${mes}/${anio}`;
}
