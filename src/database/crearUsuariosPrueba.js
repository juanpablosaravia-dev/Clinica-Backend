import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from './conexion.js';

// Setea una password real (hasheada) a los usuarios de prueba que ya vienen
// en el seed de ScriptSQL.sql, cuyos hashes son placeholders y no sirven
// para loguear. Se corre una sola vez, a mano, contra la base local:
//   node src/database/crearUsuariosPrueba.js
const USUARIOS_PRUEBA = [
  { email: 'mgomez@clinica.com', rol: 'admin', password: 'Admin123!' },
  { email: 'alopez@clinica.com', rol: 'medico', password: 'Medico123!' },
  { email: 'jperez@gmail.com', rol: 'operador', password: 'Operador123!' },
];

async function crearUsuariosPrueba() {
  for (const { email, rol, password } of USUARIOS_PRUEBA) {
    const passwordHasheada = await bcrypt.hash(password, 10);
    const [resultado] = await pool.query(
      'UPDATE usuario SET password = ? WHERE email = ? AND rol = ?',
      [passwordHasheada, email, rol]
    );

    if (resultado.affectedRows === 0) {
      console.warn(`No se encontró un usuario con email "${email}" y rol "${rol}" (revisá el seed).`);
      continue;
    }

    console.log(`Password actualizada para ${email} (rol ${rol}): ${password}`);
  }

  await pool.end();
}

crearUsuariosPrueba().catch((error) => {
  console.error('Error al crear usuarios de prueba:', error);
  process.exit(1);
});
