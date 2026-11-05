// Fecha de hoy en formato AAAA-MM-DD, en la hora local del servidor.
// No se usa toISOString(): eso da la fecha en UTC, y en Argentina (UTC-3) a
// partir de las 21:00 ya devolvería el día siguiente.
export function fechaDeHoy() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}
