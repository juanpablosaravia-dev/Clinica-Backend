import { ErrorHttp } from './errorHttp.js';

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;
// Estricto a proposito: 'HH:MM' con cero a la izquierda. Si se aceptara '9:00',
// la comparacion lexicografica de horas ('9:00' > '20:00') daria falsos positivos.
const PATRON_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function buscarCamposFaltantes(cuerpo, camposRequeridos) {
  const datos = cuerpo ?? {};
  return camposRequeridos.filter((campo) => {
    const valor = datos[campo];
    return valor === undefined || valor === null || valor === '';
  });
}

export function validarCamposRequeridos(cuerpo, camposRequeridos) {
  const camposFaltantes = buscarCamposFaltantes(cuerpo, camposRequeridos);
  if (camposFaltantes.length > 0) {
    throw new ErrorHttp(400, `Faltan campos requeridos: ${camposFaltantes.join(', ')}`);
  }
}

export function validarFormatoFecha(valor, nombreCampo = 'fecha') {
  if (typeof valor !== 'string' || !PATRON_FECHA.test(valor)) {
    throw new ErrorHttp(400, `El campo ${nombreCampo} debe tener el formato AAAA-MM-DD`);
  }

  // El patron acepta fechas inexistentes como 2026-02-30: se reconstruye la
  // fecha y se compara para descartarlas.
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const esFechaReal =
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
  if (!esFechaReal) {
    throw new ErrorHttp(400, `El campo ${nombreCampo} no corresponde a una fecha válida`);
  }
}

export function validarFormatoHora(valor, nombreCampo = 'hora') {
  if (typeof valor !== 'string' || !PATRON_HORA.test(valor)) {
    throw new ErrorHttp(400, `El campo ${nombreCampo} debe tener el formato HH:MM (por ejemplo 09:30)`);
  }
}

export function validarEnteroPositivo(valor, nombreCampo) {
  // Los filtros llegan por query string, asi que siempre son texto: Number('')
  // da 0 y Number('abc') da NaN. Se descartan los dos.
  const numero = Number(valor);
  if (String(valor).trim() === '' || !Number.isInteger(numero) || numero <= 0) {
    throw new ErrorHttp(400, `El campo ${nombreCampo} debe ser un número entero positivo`);
  }
}

export function validarLargoMaximo(valor, largoMaximo, nombreCampo) {
  if (valor === undefined || valor === null) {
    return;
  }
  if (String(valor).length > largoMaximo) {
    throw new ErrorHttp(400, `El campo ${nombreCampo} no puede superar los ${largoMaximo} caracteres`);
  }
}

// Las horas 'HH:MM' con cero a la izquierda se comparan bien como texto:
// '09:00' <= '15:30' <= '20:00'. Por eso PATRON_HORA exige ese formato.
export function horaEnRango(hora, desde, hasta) {
  if (!PATRON_HORA.test(desde) || !PATRON_HORA.test(hasta)) {
    return false;
  }
  return hora >= desde && hora <= hasta;
}
