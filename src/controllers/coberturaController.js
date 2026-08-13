import { listarCoberturas } from '../services/coberturaService.js';
import { enviarRespuesta } from '../utils/respuesta.js';

export async function obtenerCoberturas(req, res) {
  try {
    const coberturas = await listarCoberturas();
    return enviarRespuesta(res, 200, coberturas);
  } catch (error) {
    return enviarRespuesta(res, 500, null, 'Error al obtener las coberturas');
  }
}
