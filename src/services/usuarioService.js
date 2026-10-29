import bcrypt from 'bcryptjs';
import pool from '../database/conexion.js';
import { ErrorHttp } from '../utils/errorHttp.js';
import { ejecutarEnTransaccion } from '../database/transaccion.js';
import {
  validarCamposRequeridos,
  validarFormatoFecha,
  validarLargoMaximo,
} from '../utils/validaciones.js';

// El admin crea personal de la clinica; los pacientes se registran solos
// (o los da de alta el operador con el mismo formulario del registro).
const ROLES_PERSONAL = ['operador', 'medico', 'admin'];

const CAMPOS_REQUERIDOS_ALTA = [
  'nombre',
  'apellido',
  'dni',
  'email',
  'password',
  'fecha_nacimiento',
  'telefono',
  'rol',
];
const CAMPOS_REQUERIDOS_EDICION = ['nombre', 'apellido', 'dni', 'email', 'fecha_nacimiento'];

const PATRON_DNI = /^\d{7,8}$/;
const PATRON_TELEFONO = /^\d{0,10}$/;

// Largos maximos de las columnas de la tabla usuario.
function validarDatosPersonales(datos) {
  validarLargoMaximo(datos.nombre, 30, 'nombre');
  validarLargoMaximo(datos.apellido, 30, 'apellido');
  validarLargoMaximo(datos.email, 30, 'email');
  validarFormatoFecha(datos.fecha_nacimiento, 'fecha_nacimiento');
  if (!PATRON_DNI.test(String(datos.dni))) {
    throw new ErrorHttp(400, 'El DNI debe tener 7 u 8 números');
  }
  if (!PATRON_TELEFONO.test(String(datos.telefono ?? ''))) {
    throw new ErrorHttp(400, 'El teléfono debe tener solo números (hasta 10)');
  }
}

async function validarDuplicados(dni, email, idExcluido = 0) {
  const [existentes] = await pool.query(
    'SELECT id FROM usuario WHERE (dni = ? OR email = ?) AND id <> ?',
    [dni, email, idExcluido]
  );
  if (existentes.length > 0) {
    throw new ErrorHttp(400, 'El DNI o Email ya se encuentra registrado');
  }
}

// Operador y medico tienen sede; el admin opera sobre todas y el paciente no
// tiene. Devuelve el id_sede que corresponde guardar.
async function resolverSede(rol, idSede) {
  if (rol !== 'operador' && rol !== 'medico') {
    return null;
  }
  if (!idSede) {
    throw new ErrorHttp(400, 'El operador y el médico deben tener una sede asignada');
  }
  const [sedes] = await pool.query('SELECT id FROM sede WHERE id = ?', [idSede]);
  if (sedes.length === 0) {
    throw new ErrorHttp(400, 'La sede indicada no existe');
  }
  return idSede;
}

async function validarEspecialidades(especialidades) {
  if (!Array.isArray(especialidades) || especialidades.length === 0) {
    throw new ErrorHttp(400, 'El médico debe tener al menos una especialidad');
  }
  const [existentes] = await pool.query('SELECT id FROM especialidad WHERE id IN (?)', [
    especialidades,
  ]);
  if (existentes.length !== new Set(especialidades.map(Number)).size) {
    throw new ErrorHttp(400, 'Alguna de las especialidades indicadas no existe');
  }
}

async function guardarEspecialidades(conexion, idMedico, especialidades) {
  await conexion.query('DELETE FROM medico_especialidad WHERE id_medico = ?', [idMedico]);
  for (const idEspecialidad of new Set(especialidades.map(Number))) {
    await conexion.query(
      'INSERT INTO medico_especialidad (id_medico, id_especialidad) VALUES (?, ?)',
      [idMedico, idEspecialidad]
    );
  }
}

// Listado completo con el nombre de la sede y de la cobertura y, para los
// medicos, sus especialidades. El front filtra y pagina sobre este listado.
export async function listarUsuarios() {
  const [usuarios] = await pool.query(
    `SELECT u.id, u.nombre, u.apellido, u.dni, u.email, u.telefono,
            DATE_FORMAT(u.fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento,
            u.rol, u.id_sede, s.nombre AS sede, u.id_cobertura, c.nombre AS cobertura
       FROM usuario u
       LEFT JOIN sede s ON u.id_sede = s.id
       LEFT JOIN cobertura c ON u.id_cobertura = c.id
      ORDER BY u.apellido, u.nombre`
  );

  const [especialidades] = await pool.query(
    `SELECT me.id_medico, e.id, e.descripcion
       FROM medico_especialidad me
       JOIN especialidad e ON me.id_especialidad = e.id`
  );

  return usuarios.map((usuario) => ({
    ...usuario,
    especialidades: especialidades
      .filter((especialidad) => especialidad.id_medico === usuario.id)
      .map(({ id, descripcion }) => ({ id, descripcion })),
  }));
}

export async function crearUsuario(datos) {
  validarCamposRequeridos(datos, CAMPOS_REQUERIDOS_ALTA);
  validarDatosPersonales(datos);
  const { nombre, apellido, dni, email, password, fecha_nacimiento, telefono, rol } = datos;

  if (!ROLES_PERSONAL.includes(rol)) {
    throw new ErrorHttp(400, `El rol debe ser uno de: ${ROLES_PERSONAL.join(', ')}`);
  }
  const idSede = await resolverSede(rol, datos.id_sede);
  if (rol === 'medico') {
    await validarEspecialidades(datos.especialidades);
  }
  await validarDuplicados(dni, email);

  const passwordHasheada = await bcrypt.hash(password, 10);

  // Usuario y especialidades en la misma transaccion: o queda todo o nada.
  const id = await ejecutarEnTransaccion(async (conexion) => {
    const [resultado] = await conexion.query(
      `INSERT INTO usuario (nombre, apellido, dni, email, password, fecha_nacimiento, telefono, rol, id_sede, id_cobertura)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [nombre, apellido, dni, email, passwordHasheada, fecha_nacimiento, telefono, rol, idSede]
    );
    if (rol === 'medico') {
      await guardarEspecialidades(conexion, resultado.insertId, datos.especialidades);
    }
    return resultado.insertId;
  });

  return { id, nombre, apellido, dni, email, fecha_nacimiento, telefono, rol, id_sede: idSede };
}

// Edita cualquier tipo de usuario, incluidos los pacientes. El rol no se
// cambia. La contraseña es opcional: si viene, se reemplaza.
export async function actualizarUsuario(id, datos) {
  validarCamposRequeridos(datos, CAMPOS_REQUERIDOS_EDICION);
  validarDatosPersonales(datos);

  const [usuarios] = await pool.query('SELECT id, rol FROM usuario WHERE id = ?', [id]);
  if (usuarios.length === 0) {
    throw new ErrorHttp(404, 'Usuario no encontrado');
  }
  const { rol } = usuarios[0];
  const { nombre, apellido, dni, email, fecha_nacimiento, password } = datos;
  const telefono = datos.telefono ?? '';

  const idSede = await resolverSede(rol, datos.id_sede);
  let idCobertura = null;
  if (rol === 'paciente') {
    idCobertura = datos.id_cobertura;
    const [coberturas] = await pool.query('SELECT id FROM cobertura WHERE id = ?', [idCobertura ?? 0]);
    if (coberturas.length === 0) {
      throw new ErrorHttp(400, 'La cobertura indicada no existe');
    }
  }
  if (rol === 'medico') {
    await validarEspecialidades(datos.especialidades);
  }
  await validarDuplicados(dni, email, id);

  await ejecutarEnTransaccion(async (conexion) => {
    await conexion.query(
      `UPDATE usuario
          SET nombre = ?, apellido = ?, dni = ?, email = ?, fecha_nacimiento = ?, telefono = ?,
              id_sede = ?, id_cobertura = ?
        WHERE id = ?`,
      [nombre, apellido, dni, email, fecha_nacimiento, telefono, idSede, idCobertura, id]
    );
    if (password) {
      const passwordHasheada = await bcrypt.hash(password, 10);
      await conexion.query('UPDATE usuario SET password = ? WHERE id = ?', [passwordHasheada, id]);
    }
    if (rol === 'medico') {
      await guardarEspecialidades(conexion, id, datos.especialidades);
    }
  });

  return {
    id: Number(id),
    nombre,
    apellido,
    dni,
    email,
    fecha_nacimiento,
    telefono,
    rol,
    id_sede: idSede,
    id_cobertura: idCobertura,
  };
}
