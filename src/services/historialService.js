import pool from '../database/conexion.js';
import { ErrorHttp } from '../utils/errorHttp.js';
import { buscarTurnoConAgenda } from './turnoService.js';
import { validarCamposRequeridos, validarLargoMaximo } from '../utils/validaciones.js';

const CAMPOS_REQUERIDOS = ['id_turno', 'diagnostico'];
const LARGO_MAXIMO_TEXTO = 255; // las columnas de texto de historial_clinico son varchar(255)

const ESTADO_ATENDIDO = 'atendido';
const ROL_PACIENTE = 'paciente';

export async function registrarHistorial(datos, usuario) {
  validarCamposRequeridos(datos, CAMPOS_REQUERIDOS);
  const { id_turno, diagnostico, tratamiento, observaciones } = datos;
  validarLargoMaximo(diagnostico, LARGO_MAXIMO_TEXTO, 'diagnóstico');
  validarLargoMaximo(tratamiento, LARGO_MAXIMO_TEXTO, 'tratamiento');
  validarLargoMaximo(observaciones, LARGO_MAXIMO_TEXTO, 'observaciones');

  const turno = await buscarTurnoConAgenda(id_turno);

  if (Number(turno.id_medico) !== Number(usuario.id)) {
    throw new ErrorHttp(403, 'Un médico solo puede registrar historial de sus propios turnos');
  }
  if (turno.estado !== ESTADO_ATENDIDO) {
    throw new ErrorHttp(409, 'Solo se puede registrar historial de un turno atendido');
  }

  const [existentes] = await pool.query(
    'SELECT id FROM historial_clinico WHERE id_turno = ? LIMIT 1',
    [id_turno]
  );
  if (existentes.length > 0) {
    throw new ErrorHttp(409, 'Ese turno ya tiene un historial clínico registrado');
  }

  const [resultado] = await pool.query(
    `INSERT INTO historial_clinico (id_turno, id_medico, id_paciente, diagnostico, tratamiento, observaciones)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id_turno, turno.id_medico, turno.id_paciente, diagnostico, tratamiento ?? null, observaciones ?? null]
  );

  return {
    id: resultado.insertId,
    id_turno: Number(id_turno),
    id_medico: turno.id_medico,
    id_paciente: turno.id_paciente,
    diagnostico,
    tratamiento: tratamiento ?? null,
    observaciones: observaciones ?? null,
  };
}

// El paciente ve la totalidad de su historial; el medico, solo los registros
// de los turnos que el mismo atendio (id_medico = el suyo).
export async function historialDePaciente(idPaciente, usuario) {
  if (usuario.rol === ROL_PACIENTE && Number(idPaciente) !== Number(usuario.id)) {
    throw new ErrorHttp(403, 'Un paciente solo puede ver su propio historial clínico');
  }

  const condiciones = ['id_paciente = ?'];
  const valores = [idPaciente];
  if (usuario.rol !== ROL_PACIENTE) {
    condiciones.push('id_medico = ?');
    valores.push(usuario.id);
  }

  const [registros] = await pool.query(
    `SELECT id, id_turno, id_medico, id_paciente, diagnostico, tratamiento, observaciones, fecha_registro
       FROM historial_clinico
      WHERE ${condiciones.join(' AND ')}
      ORDER BY fecha_registro DESC`,
    valores
  );
  return registros;
}
