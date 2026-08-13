import bcrypt from 'bcryptjs';
import pool from '../database/conexion.js';
import { enviarRespuesta } from '../utils/respuesta.js';

const ER_DUP_ENTRY = 1062;

const CAMPOS_REQUERIDOS = [
  'nombre',
  'apellido',
  'dni',
  'email',
  'password',
  'fecha_nacimiento',
  'id_cobertura',
];

export async function registrarPaciente(req, res) {
  try {
    const { nombre, apellido, dni, email, password, fecha_nacimiento, id_cobertura } = req.body;

    const camposFaltantes = CAMPOS_REQUERIDOS.filter((campo) => {
      const valor = req.body[campo];
      return valor === undefined || valor === null || valor === '';
    });
    if (camposFaltantes.length > 0) {
      return enviarRespuesta(
        res,
        400,
        null,
        `Faltan campos requeridos: ${camposFaltantes.join(', ')}`
      );
    }

    const [coberturas] = await pool.query('SELECT id FROM cobertura WHERE id = ?', [id_cobertura]);
    if (coberturas.length === 0) {
      return enviarRespuesta(res, 400, null, 'La cobertura indicada no existe');
    }

    const [existentes] = await pool.query(
      'SELECT id FROM usuario WHERE dni = ? OR email = ?',
      [dni, email]
    );
    if (existentes.length > 0) {
      return enviarRespuesta(res, 400, null, 'El DNI o Email ya se encuentra registrado');
    }

    const passwordHasheada = await bcrypt.hash(password, 10);

    let resultado;
    try {
      // telefono es NOT NULL en la tabla pero no forma parte de la consigna de registro
      [resultado] = await pool.query(
        `INSERT INTO usuario (nombre, apellido, dni, email, password, fecha_nacimiento, telefono, rol, id_sede, id_cobertura)
         VALUES (?, ?, ?, ?, ?, ?, '', 'paciente', NULL, ?)`,
        [nombre, apellido, dni, email, passwordHasheada, fecha_nacimiento, id_cobertura]
      );
    } catch (errorInsert) {
      // Red de seguridad ante condición de carrera: si dos registros con el
      // mismo dni/email llegan casi al mismo tiempo, el SELECT previo puede
      // no alcanzar a detectarlo, pero el UNIQUE de la base (ver
      // src/database/migraciones.js) sí lo rechaza acá.
      if (errorInsert.errno === ER_DUP_ENTRY) {
        return enviarRespuesta(res, 400, null, 'El DNI o Email ya se encuentra registrado');
      }
      throw errorInsert;
    }

    return enviarRespuesta(res, 201, {
      mensaje: 'Usuario paciente registrado con éxito',
      id: resultado.insertId,
    });
  } catch (error) {
    return enviarRespuesta(res, 500, null, 'Error interno del servidor');
  }
}
