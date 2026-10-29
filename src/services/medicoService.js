import pool from '../database/conexion.js';
import { validarEnteroPositivo } from '../utils/validaciones.js';

// Listado de medicos con sus especialidades. Solo nombre, apellido y
// especialidades: ningun otro dato personal, porque lo consume cualquier rol.
//
// Filtros opcionales:
//  - id_especialidad: medicos que tienen esa especialidad.
//  - id_sede: medicos asignados a esa sede o con agenda cargada en ella
//    (un medico puede atender en mas de una sede).
export async function listarMedicos(filtros = {}) {
  const condiciones = ["u.rol = 'medico'"];
  const valores = [];

  if (filtros.id_especialidad) {
    validarEnteroPositivo(filtros.id_especialidad, 'id_especialidad');
    condiciones.push(
      'u.id IN (SELECT id_medico FROM medico_especialidad WHERE id_especialidad = ?)'
    );
    valores.push(filtros.id_especialidad);
  }
  if (filtros.id_sede) {
    validarEnteroPositivo(filtros.id_sede, 'id_sede');
    condiciones.push('(u.id_sede = ? OR u.id IN (SELECT id_medico FROM agenda WHERE id_sede = ?))');
    valores.push(filtros.id_sede, filtros.id_sede);
  }

  const [medicos] = await pool.query(
    `SELECT u.id, u.nombre, u.apellido
       FROM usuario u
      WHERE ${condiciones.join(' AND ')}
      ORDER BY u.apellido, u.nombre`,
    valores
  );
  if (medicos.length === 0) {
    return [];
  }

  // Una sola consulta para las especialidades de todos los medicos del listado.
  const [especialidades] = await pool.query(
    `SELECT me.id_medico, e.id, e.descripcion
       FROM medico_especialidad me
       JOIN especialidad e ON me.id_especialidad = e.id
      WHERE me.id_medico IN (?)
      ORDER BY e.descripcion`,
    [medicos.map((medico) => medico.id)]
  );

  return medicos.map((medico) => ({
    ...medico,
    especialidades: especialidades
      .filter((especialidad) => especialidad.id_medico === medico.id)
      .map(({ id, descripcion }) => ({ id, descripcion })),
  }));
}
