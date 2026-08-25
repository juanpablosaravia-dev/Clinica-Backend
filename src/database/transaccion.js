import pool from './conexion.js';

// Primer uso de transacciones del proyecto. La operacion recibe una conexion
// dedicada y debe usarla para TODAS sus queries: si alguna se hace contra el
// pool, esa query queda fuera de la transaccion y no se revierte.
//
// El release() va en un finally centralizado: si quedara suelto en cada
// llamador, un camino de error olvidado filtraria conexiones del pool
// (connectionLimit: 10) y el sintoma seria un servidor colgado, no un error.
export async function ejecutarEnTransaccion(operacion) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await operacion(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    // Si la conexion se cayo, el rollback tambien falla. Se descarta ese error
    // para no tapar el ErrorHttp original, que es el que tiene que ver el cliente.
    await conexion.rollback().catch(() => {});
    throw error;
  } finally {
    conexion.release();
  }
}
