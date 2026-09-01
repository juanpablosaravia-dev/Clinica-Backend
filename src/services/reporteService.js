import pool from '../database/conexion.js';
import { validarFormatoFecha } from '../utils/validaciones.js';

const ESTADO_CANCELADO = 'cancelado';
const ESTADO_ATENDIDO = 'atendido';

// Los cuatro reportes filtran por el mismo rango de fechas sobre turno.fecha,
// asi que el WHERE se arma una sola vez aca. Ambos limites son opcionales:
// sin filtros devuelve el WHERE vacio y la consulta toma todo el historico.
function armarFiltroFechas({ desde, hasta } = {}) {
  const condiciones = [];
  const valores = [];

  if (desde) {
    validarFormatoFecha(desde, 'desde');
    condiciones.push('t.fecha >= ?');
    valores.push(desde);
  }
  if (hasta) {
    validarFormatoFecha(hasta, 'hasta');
    condiciones.push('t.fecha <= ?');
    valores.push(hasta);
  }

  return {
    where: condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '',
    valores,
  };
}

export async function turnosPorEspecialidad(filtros) {
  const { where, valores } = armarFiltroFechas(filtros);

  const [filas] = await pool.query(
    `SELECT e.id AS id_especialidad, e.descripcion, COUNT(*) AS cantidad
       FROM turno t
       JOIN agenda a ON t.id_agenda = a.id
       JOIN especialidad e ON a.id_especialidad = e.id
       ${where}
      GROUP BY e.id, e.descripcion
      ORDER BY cantidad DESC`,
    valores
  );
  return filas;
}

export async function turnosPorSede(filtros) {
  const { where, valores } = armarFiltroFechas(filtros);

  const [filas] = await pool.query(
    `SELECT s.id AS id_sede, s.nombre, COUNT(*) AS cantidad
       FROM turno t
       JOIN agenda a ON t.id_agenda = a.id
       JOIN sede s ON a.id_sede = s.id
       ${where}
      GROUP BY s.id, s.nombre
      ORDER BY cantidad DESC`,
    valores
  );
  return filas;
}

// Ranking completo (no solo el primero), del que mas atendio al que menos.
export async function rankingMedicos(filtros) {
  const { where, valores } = armarFiltroFechas(filtros);
  // El estado se suma al WHERE que ya armo el helper: si no habia filtros de
  // fecha el where viene vacio, asi que hay que abrir el WHERE en ese caso.
  const whereConEstado = where
    ? `${where} AND t.estado = ?`
    : 'WHERE t.estado = ?';

  const [filas] = await pool.query(
    `SELECT u.id AS id_medico, u.nombre, u.apellido, COUNT(*) AS turnos_atendidos
       FROM turno t
       JOIN agenda a ON t.id_agenda = a.id
       JOIN usuario u ON a.id_medico = u.id
       ${whereConEstado}
      GROUP BY u.id, u.nombre, u.apellido
      ORDER BY turnos_atendidos DESC`,
    [...valores, ESTADO_ATENDIDO]
  );
  return filas;
}

export async function tasaCancelacion(filtros) {
  const { where, valores } = armarFiltroFechas(filtros);

  // Una sola pasada: COUNT(*) da el total y el SUM condicional los cancelados.
  const [filas] = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN t.estado = ? THEN 1 ELSE 0 END) AS cancelados
       FROM turno t
       ${where}`,
    [ESTADO_CANCELADO, ...valores]
  );

  const total = Number(filas[0].total);
  const cancelados = Number(filas[0].cancelados ?? 0);
  // Sin turnos en el periodo la tasa es 0 y no una division por cero.
  const tasa = total === 0 ? 0 : Number((cancelados / total).toFixed(4));

  return { total, cancelados, tasa };
}
