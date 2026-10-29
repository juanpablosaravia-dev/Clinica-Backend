// Duracion de cada turno. La usan la consulta de horarios libres y la
// validacion del alta de turno, asi las dos reglas no pueden desalinearse.
export const DURACION_TURNO_MINUTOS = 30;

function aMinutos(hora) {
  const [horas, minutos] = String(hora).slice(0, 5).split(':').map(Number);
  return horas * 60 + minutos;
}

function aHora(minutosTotales) {
  const horas = String(Math.floor(minutosTotales / 60)).padStart(2, '0');
  const minutos = String(minutosTotales % 60).padStart(2, '0');
  return `${horas}:${minutos}`;
}

// Horarios de inicio de turno dentro de una franja: '09:00'-'10:30' da
// ['09:00', '09:30', '10:00']. El ultimo turno tiene que terminar antes de
// la hora de salida, por eso no se incluye '10:30'.
export function generarHorarios(horaEntrada, horaSalida) {
  const horarios = [];
  const fin = aMinutos(horaSalida);
  for (let inicio = aMinutos(horaEntrada); inicio + DURACION_TURNO_MINUTOS <= fin; inicio += DURACION_TURNO_MINUTOS) {
    horarios.push(aHora(inicio));
  }
  return horarios;
}

// Fecha de hoy en formato AAAA-MM-DD, con la hora local del servidor.
export function fechaDeHoy() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

// Hora actual en formato HH:MM.
export function horaActual() {
  const ahora = new Date();
  return aHora(ahora.getHours() * 60 + ahora.getMinutes());
}
