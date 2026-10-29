import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from './conexion.js';
import { ejecutarEnTransaccion } from './transaccion.js';

// Carga datos de prueba para probar el frontend con los cuatro roles:
//  - tres medicos con distintas especialidades (Ana Lopez atiende en dos sedes)
//  - un paciente con contraseña real
//  - agenda para ayer, hoy y los proximos dias (las fechas se calculan al correrlo)
//  - turnos en los tres estados (confirmado, cancelado y atendido con historial)
//
// Se corre una sola vez, despues de `pnpm seed:usuarios`:
//   pnpm seed:demo
// Si los datos ya estan cargados, no hace nada.

const DNI_MEDICO_CARDIOLOGIA = '30111222';
const ID_ANA_LOPEZ = 3; // medica del seed de ScriptSQL.sql (Traumatologia, sede 1)
const ID_FRANCO = 2; // paciente del seed de ScriptSQL.sql
const SEDE_CENTRO = 1;
const SEDE_NORTE = 2;

// Fecha AAAA-MM-DD a `dias` de hoy (negativo = pasado).
function fechaRelativa(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

async function buscarOCrearEspecialidad(conexion, descripcion) {
  const [filas] = await conexion.query('SELECT id FROM especialidad WHERE descripcion = ?', [
    descripcion,
  ]);
  if (filas.length > 0) {
    return filas[0].id;
  }
  const [resultado] = await conexion.query('INSERT INTO especialidad (descripcion) VALUES (?)', [
    descripcion,
  ]);
  return resultado.insertId;
}

async function crearUsuario(conexion, datos) {
  const [resultado] = await conexion.query(
    `INSERT INTO usuario (nombre, apellido, dni, email, password, fecha_nacimiento, telefono, rol, id_sede, id_cobertura)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.nombre,
      datos.apellido,
      datos.dni,
      datos.email,
      datos.password,
      datos.fecha_nacimiento,
      datos.telefono,
      datos.rol,
      datos.id_sede ?? null,
      datos.id_cobertura ?? null,
    ]
  );
  return resultado.insertId;
}

async function crearAgenda(conexion, fecha, entrada, salida, idMedico, idEspecialidad, idSede) {
  const [resultado] = await conexion.query(
    'INSERT INTO agenda (hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede) VALUES (?, ?, ?, ?, ?, ?)',
    [entrada, salida, fecha, idMedico, idEspecialidad, idSede]
  );
  return resultado.insertId;
}

async function crearTurno(conexion, idAgenda, fecha, hora, idPaciente, nota, estado) {
  const [resultado] = await conexion.query(
    `INSERT INTO turno (nota, id_agenda, fecha, hora, id_paciente, id_cobertura, estado)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [nota, idAgenda, fecha, hora, idPaciente, estado]
  );
  return resultado.insertId;
}

async function crearDatosPrueba() {
  const [yaCargados] = await pool.query('SELECT id FROM usuario WHERE dni = ?', [
    DNI_MEDICO_CARDIOLOGIA,
  ]);
  if (yaCargados.length > 0) {
    console.log('Los datos de prueba ya estaban cargados: no se hizo nada.');
    await pool.end();
    return;
  }

  const passwordMedico = await bcrypt.hash('Medico123!', 10);
  const passwordPaciente = await bcrypt.hash('Paciente123!', 10);
  const ayer = fechaRelativa(-1);
  const hoy = fechaRelativa(0);
  const manana = fechaRelativa(1);
  const pasado = fechaRelativa(2);

  await ejecutarEnTransaccion(async (conexion) => {
    const traumatologia = await buscarOCrearEspecialidad(conexion, 'Traumatologia');
    const cardiologia = await buscarOCrearEspecialidad(conexion, 'Cardiologia');
    const pediatria = await buscarOCrearEspecialidad(conexion, 'Pediatria');

    const carlos = await crearUsuario(conexion, {
      nombre: 'Carlos',
      apellido: 'Ruiz',
      dni: DNI_MEDICO_CARDIOLOGIA,
      email: 'cruiz@clinica.com',
      password: passwordMedico,
      fecha_nacimiento: '1978-02-11',
      telefono: '3424333444',
      rol: 'medico',
      id_sede: SEDE_NORTE,
    });
    const laura = await crearUsuario(conexion, {
      nombre: 'Laura',
      apellido: 'Diaz',
      dni: '31222333',
      email: 'ldiaz@clinica.com',
      password: passwordMedico,
      fecha_nacimiento: '1985-07-23',
      telefono: '3424555666',
      rol: 'medico',
      id_sede: SEDE_CENTRO,
    });
    const sofia = await crearUsuario(conexion, {
      nombre: 'Sofia',
      apellido: 'Martinez',
      dni: '35111222',
      email: 'smartinez@mail.com',
      password: passwordPaciente,
      fecha_nacimiento: '1992-04-15',
      telefono: '3424999888',
      rol: 'paciente',
      id_cobertura: 1,
    });

    await conexion.query(
      'INSERT INTO medico_especialidad (id_medico, id_especialidad) VALUES (?, ?), (?, ?)',
      [carlos, cardiologia, laura, pediatria]
    );

    // Ana Lopez atiende en las dos sedes (mañana en Centro, tarde en Norte).
    const anaAyer = await crearAgenda(conexion, ayer, '09:00', '12:00', ID_ANA_LOPEZ, traumatologia, SEDE_CENTRO);
    const anaHoyCentro = await crearAgenda(conexion, hoy, '09:00', '13:00', ID_ANA_LOPEZ, traumatologia, SEDE_CENTRO);
    const anaHoyNorte = await crearAgenda(conexion, hoy, '15:00', '19:00', ID_ANA_LOPEZ, traumatologia, SEDE_NORTE);
    await crearAgenda(conexion, manana, '09:00', '13:00', ID_ANA_LOPEZ, traumatologia, SEDE_CENTRO);
    await crearAgenda(conexion, pasado, '15:00', '19:00', ID_ANA_LOPEZ, traumatologia, SEDE_NORTE);
    const carlosHoy = await crearAgenda(conexion, hoy, '10:00', '14:00', carlos, cardiologia, SEDE_NORTE);
    await crearAgenda(conexion, pasado, '10:00', '14:00', carlos, cardiologia, SEDE_NORTE);
    const lauraManana = await crearAgenda(conexion, manana, '14:00', '18:00', laura, pediatria, SEDE_CENTRO);
    await crearAgenda(conexion, hoy, '14:00', '18:00', laura, pediatria, SEDE_CENTRO);

    // Turnos en los tres estados.
    const atendido = await crearTurno(conexion, anaAyer, ayer, '09:30', sofia, 'Dolor de rodilla', 'atendido');
    await conexion.query(
      `INSERT INTO historial_clinico (id_turno, id_medico, id_paciente, diagnostico, tratamiento, observaciones)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [atendido, ID_ANA_LOPEZ, sofia, 'Tendinitis rotuliana', 'Reposo y hielo 7 días', 'Control en 2 semanas']
    );
    await crearTurno(conexion, anaHoyCentro, hoy, '10:00', sofia, 'Control de rodilla', 'confirmado');
    await crearTurno(conexion, anaHoyCentro, hoy, '11:30', ID_FRANCO, 'Dolor de hombro', 'confirmado');
    await crearTurno(conexion, anaHoyNorte, hoy, '15:30', sofia, 'Consulta general', 'cancelado');
    await crearTurno(conexion, carlosHoy, hoy, '11:00', ID_FRANCO, 'Control de presión', 'confirmado');
    await crearTurno(conexion, lauraManana, manana, '14:30', sofia, 'Vacunación', 'confirmado');

    await conexion.query(
      `INSERT INTO notificacion (id_usuario, tipo, mensaje, leida) VALUES
         (?, 'turno_confirmado', 'Tu turno de mañana a las 14:30 fue confirmado.', 0),
         (?, 'turno_atendido', 'Tu turno de ayer a las 09:30 fue registrado como atendido.', 0)`,
      [sofia, sofia]
    );
  });

  console.log('Datos de prueba cargados:');
  console.log('  Médicos (contraseña Medico123!): Ana Lopez 20111222, Carlos Ruiz 30111222, Laura Diaz 31222333');
  console.log('  Paciente (contraseña Paciente123!): Sofia Martinez 35111222');
  await pool.end();
}

crearDatosPrueba().catch((error) => {
  console.error('Error al cargar los datos de prueba:', error);
  process.exit(1);
});
