// Error tipado para que los servicios puedan expresar fallos de negocio
// (400, 401, 404, etc.) sin conocer Express. El controller lo atrapa y lo
// traduce a la respuesta uniforme { codigo, estado, datos }.
export class ErrorHttp extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.codigo = codigo;
  }
}
