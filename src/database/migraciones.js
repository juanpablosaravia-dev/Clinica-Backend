import pool from './conexion.js';

const ER_DUP_KEYNAME = 1061;

// Aplica una sentencia DDL tolerando el error que indica que ya fue aplicada,
// para que arrancar el servidor mil veces tenga el mismo efecto que arrancarlo
// una. Cada migracion declara que errores considera "ya estaba hecho".
async function ejecutarMigracion(descripcion, definicionSql, erroresIgnorables = [ER_DUP_KEYNAME]) {
  try {
    await pool.query(definicionSql);
  } catch (error) {
    if (erroresIgnorables.includes(error.errno)) {
      return;
    }
    throw new Error(`Fallo la migración "${descripcion}": ${error.message}`);
  }
}

// El script de base provisto por la cátedra no define UNIQUE en dni/email
// (solo PK en id). Sin esa restricción, el chequeo de duplicados del
// registro (SELECT antes del INSERT) queda expuesto a una condición de
// carrera entre dos requests simultáneos. Se agrega acá, de forma
// idempotente, para no depender de tocar Diseño/ScriptSQL.sql.
export async function asegurarRestricciones() {
  await ejecutarMigracion(
    'uq_usuario_dni',
    'ALTER TABLE usuario ADD UNIQUE KEY uq_usuario_dni (dni)'
  );
  await ejecutarMigracion(
    'uq_usuario_email',
    'ALTER TABLE usuario ADD UNIQUE KEY uq_usuario_email (email)'
  );

  // notificacion.id es tinyint(4): el AUTO_INCREMENT se agota a las 127 filas y
  // a partir de ahí todo INSERT falla con 500. Es la tabla que más crece (una o
  // dos filas por operación de turno) y ninguna FK la referencia, así que
  // ampliarla es seguro. Volver a ejecutarlo sobre una columna que ya es INT no
  // produce error, por eso no necesita códigos ignorables.
  await ejecutarMigracion(
    'ampliación de notificacion.id a INT',
    'ALTER TABLE notificacion MODIFY id INT NOT NULL AUTO_INCREMENT',
    []
  );

  // Mismo problema que notificacion.id, y mas silencioso todavia: log_auditoria.id
  // tambien es tinyint(4), asi que el AUTO_INCREMENT se agota a las 127 filas. Como
  // el middleware `auditar` traga a proposito el error del INSERT (para no tumbar
  // una operacion que para el cliente ya salio bien), el sintoma no seria un 500
  // sino que los logs dejarian de escribirse sin que nadie se entere. Ninguna FK
  // referencia log_auditoria.id, asi que ampliarla no da el error 3780 que si
  // impide tocar turno e historial_clinico.
  await ejecutarMigracion(
    'ampliación de log_auditoria.id a INT',
    'ALTER TABLE log_auditoria MODIFY id INT NOT NULL AUTO_INCREMENT',
    []
  );
}
