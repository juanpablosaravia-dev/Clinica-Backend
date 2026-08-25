import bcrypt from 'bcryptjs';
import pool from '../database/conexion.js';
import { firmarToken } from '../utils/token.js';
import { ErrorHttp } from '../utils/errorHttp.js';
import { validarCamposRequeridos } from '../utils/validaciones.js';

const ER_DUP_ENTRY = 1062;

const CAMPOS_REQUERIDOS_REGISTRO = [
  'nombre',
  'apellido',
  'dni',
  'email',
  'password',
  'fecha_nacimiento',
  'id_cobertura',
];

const CAMPOS_REQUERIDOS_LOGIN = ['email', 'password'];

export async function registrarPaciente(datos) {
  validarCamposRequeridos(datos, CAMPOS_REQUERIDOS_REGISTRO);
  const { nombre, apellido, dni, email, password, fecha_nacimiento, id_cobertura } = datos;

  const [coberturas] = await pool.query('SELECT id FROM cobertura WHERE id = ?', [id_cobertura]);
  if (coberturas.length === 0) {
    throw new ErrorHttp(400, 'La cobertura indicada no existe');
  }

  const [existentes] = await pool.query(
    'SELECT id FROM usuario WHERE dni = ? OR email = ?',
    [dni, email]
  );
  if (existentes.length > 0) {
    throw new ErrorHttp(400, 'El DNI o Email ya se encuentra registrado');
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
      throw new ErrorHttp(400, 'El DNI o Email ya se encuentra registrado');
    }
    throw errorInsert;
  }

  return { mensaje: 'Usuario paciente registrado con éxito', id: resultado.insertId };
}

export async function iniciarSesion(credenciales) {
  validarCamposRequeridos(credenciales, CAMPOS_REQUERIDOS_LOGIN);
  const { email, password } = credenciales;

  const [usuarios] = await pool.query(
    'SELECT id, password, rol, id_sede FROM usuario WHERE email = ?',
    [email]
  );

  // Se responde el mismo mensaje cuando el email no existe y cuando la
  // contraseña es incorrecta, para no revelar qué emails están registrados.
  if (usuarios.length === 0) {
    throw new ErrorHttp(401, 'Credenciales inválidas');
  }

  const usuario = usuarios[0];
  const passwordCoincide = await bcrypt.compare(password, usuario.password);
  if (!passwordCoincide) {
    throw new ErrorHttp(401, 'Credenciales inválidas');
  }

  const token = firmarToken({
    id: usuario.id,
    rol: usuario.rol,
    id_sede: usuario.id_sede,
  });

  return { token };
}

// Reconstruye el perfil a partir del id que viaja en el token, sin exponer
// nunca la contraseña hasheada.
export async function obtenerPerfil(idUsuario) {
  const [usuarios] = await pool.query(
    'SELECT id, nombre, apellido, email, rol, id_sede FROM usuario WHERE id = ?',
    [idUsuario]
  );

  if (usuarios.length === 0) {
    // El token es válido pero el usuario fue dado de baja después de emitirlo.
    throw new ErrorHttp(404, 'Usuario no encontrado');
  }

  return usuarios[0];
}
