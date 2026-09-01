import pool from '../database/conexion.js';
import { validarFormatoFecha } from '../utils/validaciones.js';

export const ACCION_ALTA = 'ALTA';
export const ACCION_BAJA = 'BAJA';
export const ACCION_MODIFICACION = 'MODIFICACION';

const LARGO_MAXIMO_DETALLE = 255; // log_auditoria.detalle es varchar(255)

// El log no tiene endpoint de alta: lo escribe solo el middleware `auditar`
// cuando una operacion sensible termino bien. Mismo criterio que las
// notificaciones de la semana 3.
export async function registrarLog({ id_usuario, accion, entidad, id_entidad, detalle }) {
  // Igual que en las notificaciones: sin este recorte un detalle largo
  // dispararia ER_DATA_TOO_LONG y terminaria en un 500.
  const detalleRecortado = detalle ? String(detalle).slice(0, LARGO_MAXIMO_DETALLE) : null;

  const [resultado] = await pool.query(
    'INSERT INTO log_auditoria (id_usuario, accion, entidad, id_entidad, detalle) VALUES (?, ?, ?, ?, ?)',
    [id_usuario, accion, entidad, id_entidad ?? null, detalleRecortado]
  );

  return {
    id: resultado.insertId,
    id_usuario,
    accion,
    entidad,
    id_entidad: id_entidad ?? null,
    detalle: detalleRecortado,
  };
}

// Los tres filtros son opcionales y se combinan entre si. El rango de fechas
// compara contra la parte de fecha de `log_auditoria.fecha`, que es datetime:
// sin DATE() un log de las 14:30 quedaria fuera de un `hasta` del mismo dia.
export async function listarLogs(filtros = {}) {
  const { id_usuario, entidad, desde, hasta } = filtros;
  const condiciones = [];
  const valores = [];

  if (id_usuario) {
    condiciones.push('id_usuario = ?');
    valores.push(id_usuario);
  }
  if (entidad) {
    condiciones.push('entidad = ?');
    valores.push(entidad);
  }
  if (desde) {
    validarFormatoFecha(desde, 'desde');
    condiciones.push('DATE(fecha) >= ?');
    valores.push(desde);
  }
  if (hasta) {
    validarFormatoFecha(hasta, 'hasta');
    condiciones.push('DATE(fecha) <= ?');
    valores.push(hasta);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [logs] = await pool.query(
    `SELECT id, id_usuario, accion, entidad, id_entidad, detalle, fecha
       FROM log_auditoria
       ${where}
       ORDER BY fecha DESC, id DESC`,
    valores
  );
  return logs;
}
