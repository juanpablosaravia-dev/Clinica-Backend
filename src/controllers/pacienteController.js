import * as pacienteService from '../services/pacienteService.js';
import { enviarRespuesta } from '../utils/respuesta.js';
import { manejarError } from '../utils/manejarError.js';

export async function buscarPacientes(req, res) {
  try {
    const pacientes = await pacienteService.buscarPacientes(req.query.busqueda);
    return enviarRespuesta(res, 200, pacientes);
  } catch (error) {
    return manejarError(res, error);
  }
}
