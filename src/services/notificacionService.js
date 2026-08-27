import pool from '../database/conexion.js';
import { ErrorHttp } from '../utils/errorHttp.js';

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

// Solo las del usuario autenticado. Se desempata por id porque cancelar un
// turno genera dos notificaciones (paciente y médico) en el mismo segundo.
export async function listarNotificaciones(idUsuario) {
  const [notificaciones] = await pool.query(
    'SELECT id, id_usuario, tipo, mensaje, leida, fecha FROM notificacion WHERE id_usuario = ? ORDER BY fecha DESC, id DESC',
    [idUsuario]
  );
  return notificaciones;
}

export async function marcarNotificacionLeida(id, usuario) {
  const [notificaciones] = await pool.query(
    'SELECT id, id_usuario, tipo, mensaje, leida, fecha FROM notificacion WHERE id = ?',
    [id]
  );
  if (notificaciones.length === 0) {
    throw new ErrorHttp(404, 'Notificación no encontrada');
  }

  const notificacion = notificaciones[0];
  if (Number(notificacion.id_usuario) !== Number(usuario.id)) {
    throw new ErrorHttp(403, 'No puede marcar como leída una notificación de otro usuario');
  }

  await pool.query('UPDATE notificacion SET leida = 1 WHERE id = ?', [id]);
  return { ...notificacion, leida: 1 };
}
