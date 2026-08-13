import pool from './conexion.js';

const ER_DUP_KEYNAME = 1061;

async function agregarRestriccionUnica(nombreIndice, definicionSql) {
  try {
    await pool.query(definicionSql);
  } catch (error) {
    if (error.errno !== ER_DUP_KEYNAME) {
      throw error;
    }
  }
}

// El script de base provisto por la cátedra no define UNIQUE en dni/email
// (solo PK en id). Sin esa restricción, el chequeo de duplicados del
// registro (SELECT antes del INSERT) queda expuesto a una condición de
// carrera entre dos requests simultáneos. Se agrega acá, de forma
// idempotente, para no depender de tocar Diseño/ScriptSQL.sql.
export async function asegurarRestricciones() {
  await agregarRestriccionUnica(
    'uq_usuario_dni',
    'ALTER TABLE usuario ADD UNIQUE KEY uq_usuario_dni (dni)'
  );
  await agregarRestriccionUnica(
    'uq_usuario_email',
    'ALTER TABLE usuario ADD UNIQUE KEY uq_usuario_email (email)'
  );
}
