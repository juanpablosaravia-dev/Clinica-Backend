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

const CAMPOS_REQUERIDOS_LOGIN = ['dni', 'password'];

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
  const { dni, password } = credenciales;

  const [usuarios] = await pool.query(
    'SELECT id, password, rol, id_sede FROM usuario WHERE dni = ?',
    [dni]
  );

  // Se responde el mismo mensaje cuando el DNI no existe y cuando la
  // contraseña es incorrecta, para no revelar qué DNIs están registrados.
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
// nunca la contraseña hasheada. Incluye los nombres de sede y cobertura para la
// pantalla "Mis datos personales" del paciente.
export async function obtenerPerfil(idUsuario) {
  const [usuarios] = await pool.query(
    `SELECT u.id, u.nombre, u.apellido, u.dni, u.email, u.rol, u.id_sede, u.telefono,
            DATE_FORMAT(u.fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento,
            u.id_cobertura, c.nombre AS cobertura, s.nombre AS sede
       FROM usuario u
       LEFT JOIN cobertura c ON u.id_cobertura = c.id
       LEFT JOIN sede s ON u.id_sede = s.id
      WHERE u.id = ?`,
    [idUsuario]
  );

  if (usuarios.length === 0) {
    // El token es válido pero el usuario fue dado de baja después de emitirlo.
    throw new ErrorHttp(404, 'Usuario no encontrado');
  }

  return usuarios[0];
}

const PATRON_TELEFONO = /^\d{0,10}$/;
const LARGO_MINIMO_PASSWORD = 6;

// El paciente solo puede cambiar email, contraseña, teléfono y cobertura. El
// resto de los campos del body se ignora a propósito.
export async function actualizarMisDatos(idUsuario, datos) {
  validarCamposRequeridos(datos, ['email', 'id_cobertura']);
  const { email, id_cobertura, password } = datos;
  const telefono = datos.telefono ?? '';

  if (String(email).length > 30) {
    throw new ErrorHttp(400, 'El campo email no puede superar los 30 caracteres');
  }
  if (!PATRON_TELEFONO.test(String(telefono))) {
    throw new ErrorHttp(400, 'El teléfono debe tener solo números (hasta 10)');
  }
  if (password && String(password).length < LARGO_MINIMO_PASSWORD) {
    throw new ErrorHttp(400, 'La contraseña debe tener al menos 6 caracteres');
  }

  const [coberturas] = await pool.query('SELECT id FROM cobertura WHERE id = ?', [id_cobertura]);
  if (coberturas.length === 0) {
    throw new ErrorHttp(400, 'La cobertura indicada no existe');
  }

  const [existentes] = await pool.query('SELECT id FROM usuario WHERE email = ? AND id <> ?', [
    email,
    idUsuario,
  ]);
  if (existentes.length > 0) {
    throw new ErrorHttp(400, 'El email ya se encuentra registrado');
  }

  await pool.query('UPDATE usuario SET email = ?, telefono = ?, id_cobertura = ? WHERE id = ?', [
    email,
    telefono,
    id_cobertura,
    idUsuario,
  ]);
  if (password) {
    const passwordHasheada = await bcrypt.hash(password, 10);
    await pool.query('UPDATE usuario SET password = ? WHERE id = ?', [passwordHasheada, idUsuario]);
  }

  return obtenerPerfil(idUsuario);
}
