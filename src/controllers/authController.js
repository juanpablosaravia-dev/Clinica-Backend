import bcrypt from 'bcryptjs';
import pool from '../database/conexion.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { firmarToken } from '../utils/token.js';

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

const CAMPOS_REQUERIDOS_LOGIN = ['email', 'password'];

function buscarCamposFaltantes(cuerpo, camposRequeridos) {
  const datos = cuerpo ?? {};
  return camposRequeridos.filter((campo) => {
    const valor = datos[campo];
    return valor === undefined || valor === null || valor === '';
  });
}

export async function registrarPaciente(req, res) {
  try {
    const { nombre, apellido, dni, email, password, fecha_nacimiento, id_cobertura } = req.body;

    const camposFaltantes = buscarCamposFaltantes(req.body, CAMPOS_REQUERIDOS);
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

export async function iniciarSesion(req, res) {
  try {
    const camposFaltantes = buscarCamposFaltantes(req.body, CAMPOS_REQUERIDOS_LOGIN);
    if (camposFaltantes.length > 0) {
      return enviarRespuesta(
        res,
        400,
        null,
        `Faltan campos requeridos: ${camposFaltantes.join(', ')}`
      );
    }

    const { email, password } = req.body;

    const [usuarios] = await pool.query(
      'SELECT id, password, rol, id_sede FROM usuario WHERE email = ?',
      [email]
    );

    // Se responde el mismo mensaje cuando el email no existe y cuando la
    // contraseña es incorrecta, para no revelar qué emails están registrados.
    if (usuarios.length === 0) {
      return enviarRespuesta(res, 401, null, 'Credenciales inválidas');
    }

    const usuario = usuarios[0];
    const passwordCoincide = await bcrypt.compare(password, usuario.password);
    if (!passwordCoincide) {
      return enviarRespuesta(res, 401, null, 'Credenciales inválidas');
    }

    const token = firmarToken({
      id: usuario.id,
      rol: usuario.rol,
      id_sede: usuario.id_sede,
    });

    return enviarRespuesta(res, 200, { token });
  } catch (error) {
    return enviarRespuesta(res, 500, null, 'Error interno del servidor');
  }
}

// Endpoint de prueba de verificarToken: reconstruye el perfil a partir del id
// que viaja en el token, sin exponer nunca la contraseña hasheada.
export async function obtenerPerfil(req, res) {
  try {
    const [usuarios] = await pool.query(
      'SELECT id, nombre, apellido, email, rol, id_sede FROM usuario WHERE id = ?',
      [req.usuario.id]
    );

    if (usuarios.length === 0) {
      // El token es válido pero el usuario fue dado de baja después de emitirlo.
      return enviarRespuesta(res, 404, null, 'Usuario no encontrado');
    }

    return enviarRespuesta(res, 200, usuarios[0]);
  } catch (error) {
    return enviarRespuesta(res, 500, null, 'Error interno del servidor');
  }
}

// Endpoint de prueba de verificarRol: sólo se alcanza con rol 'admin'.
export function verificarAccesoAdmin(req, res) {
  return enviarRespuesta(res, 200, {
    mensaje: 'Acceso administrativo concedido',
    id: req.usuario.id,
    rol: req.usuario.rol,
  });
}
