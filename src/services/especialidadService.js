import pool from '../database/conexion.js';
import { ErrorHttp } from '../utils/errorHttp.js';

const CAMPOS_REQUERIDOS = ['descripcion'];

function buscarCamposFaltantes(cuerpo, camposRequeridos) {
  const datos = cuerpo ?? {};
  return camposRequeridos.filter((campo) => {
    const valor = datos[campo];
    return valor === undefined || valor === null || valor === '';
  });
}

function validarCamposRequeridos(cuerpo) {
  const camposFaltantes = buscarCamposFaltantes(cuerpo, CAMPOS_REQUERIDOS);
  if (camposFaltantes.length > 0) {
    throw new ErrorHttp(400, `Faltan campos requeridos: ${camposFaltantes.join(', ')}`);
  }
}

async function buscarEspecialidadPorId(id) {
  const [especialidades] = await pool.query(
    'SELECT id, descripcion FROM especialidad WHERE id = ?',
    [id]
  );
  if (especialidades.length === 0) {
    throw new ErrorHttp(404, 'Especialidad no encontrada');
  }
  return especialidades[0];
}

export async function listarEspecialidades() {
  const [especialidades] = await pool.query('SELECT id, descripcion FROM especialidad');
  return especialidades;
}

export async function crearEspecialidad(datos) {
  validarCamposRequeridos(datos);
  const { descripcion } = datos;

  const [resultado] = await pool.query('INSERT INTO especialidad (descripcion) VALUES (?)', [
    descripcion,
  ]);

  return { id: resultado.insertId, descripcion };
}

export async function actualizarEspecialidad(id, datos) {
  validarCamposRequeridos(datos);
  await buscarEspecialidadPorId(id);
  const { descripcion } = datos;

  await pool.query('UPDATE especialidad SET descripcion = ? WHERE id = ?', [descripcion, id]);

  return { id: Number(id), descripcion };
}

export async function eliminarEspecialidad(id) {
  await buscarEspecialidadPorId(id);

  const [medicosAsociados] = await pool.query(
    'SELECT id FROM medico_especialidad WHERE id_especialidad = ? LIMIT 1',
    [id]
  );
  if (medicosAsociados.length > 0) {
    throw new ErrorHttp(409, 'No se puede eliminar la especialidad: tiene médicos asociados');
  }

  await pool.query('DELETE FROM especialidad WHERE id = ?', [id]);
  return { mensaje: 'Especialidad eliminada con éxito' };
}
