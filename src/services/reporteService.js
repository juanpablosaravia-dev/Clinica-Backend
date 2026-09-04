import pool from '../database/conexion.js';
import { ErrorHttp } from '../utils/errorHttp.js';
import { validarFormatoFecha } from '../utils/validaciones.js';

const ESTADO_CONFIRMADO = 'confirmado';
const ESTADO_CANCELADO = 'cancelado';
const ESTADO_ATENDIDO = 'atendido';

const ESTADOS_VALIDOS = [ESTADO_CONFIRMADO, ESTADO_CANCELADO, ESTADO_ATENDIDO];

// Los cuatro reportes filtran por el mismo rango de fechas sobre turno.fecha,
// asi que el WHERE se arma una sola vez aca. Los filtros son opcionales:
// sin ninguno devuelve el WHERE vacio y la consulta toma todo el historico.
//
// `estado` solo lo pasan los dos reportes de cantidad. El ranking cuenta siempre
// los 'atendido' (lo pide la consigna) y la tasa de cancelacion necesita el total
// del periodo como denominador, asi que ninguno de los dos lo admite.
function armarFiltroTurnos({ desde, hasta, estado } = {}) {
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
  if (estado) {
    // Mismo criterio que validarFormatoFecha: un valor que no existe es un error
    // del cliente (400) y no un reporte vacio con 200, que se leeria como "no
    // hubo turnos" cuando en realidad el filtro estaba mal escrito.
    if (!ESTADOS_VALIDOS.includes(estado)) {
      throw new ErrorHttp(400, `El campo estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`);
    }
    condiciones.push('t.estado = ?');
    valores.push(estado);
  }

  return {
    where: condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '',
    valores,
  };
}

// Sin ?estado=, `cantidad` es el total de turnos del periodo (la demanda), asi
// que cancelar uno no mueve el numero. Con ?estado=cancelado se ve cuantos de
// esos turnos se cancelaron.
export async function turnosPorEspecialidad(filtros) {
  const { where, valores } = armarFiltroTurnos(filtros);

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
  const { where, valores } = armarFiltroTurnos(filtros);

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
export async function rankingMedicos(filtros = {}) {
  // El estado no es configurable aca: "turnos atendidos" es parte de la
  // definicion del indicador, asi que un ?estado= en la query se ignora.
  const { where, valores } = armarFiltroTurnos({ desde: filtros.desde, hasta: filtros.hasta });
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

export async function tasaCancelacion(filtros = {}) {
  // Tampoco admite ?estado=: el denominador de la tasa es el total de turnos del
  // periodo. Filtrarlo por estado daria siempre 0 o 1.
  const { where, valores } = armarFiltroTurnos({ desde: filtros.desde, hasta: filtros.hasta });

  // Una sola pasada: COUNT(*) da el total y el SUM condicional los cancelados.
  // El ? del SUM va primero porque esta en el SELECT, antes del WHERE.
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
