import pool from '../database/conexion.js';
import { ErrorHttp } from '../utils/errorHttp.js';

const LIMITE_RESULTADOS = 20;

// Busca pacientes por DNI exacto o por apellido (que empiece con el texto).
export async function buscarPacientes(busqueda) {
  const texto = String(busqueda ?? '').trim();
  if (texto === '') {
    throw new ErrorHttp(400, 'Indique un DNI o apellido para buscar');
  }

  const [pacientes] = await pool.query(
    `SELECT u.id, u.nombre, u.apellido, u.dni,
            DATE_FORMAT(u.fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento,
            u.id_cobertura, c.nombre AS cobertura
       FROM usuario u
       LEFT JOIN cobertura c ON u.id_cobertura = c.id
      WHERE u.rol = 'paciente' AND (u.dni = ? OR u.apellido LIKE ?)
      ORDER BY u.apellido, u.nombre
      LIMIT ?`,
    [texto, `${texto}%`, LIMITE_RESULTADOS]
  );
  return pacientes;
}
