import express from 'express';
import cors from 'cors';
import saludRoutes from './routes/saludRoutes.js';
import coberturaRoutes from './routes/coberturaRoutes.js';
import authRoutes from './routes/authRoutes.js';
import sedeRoutes from './routes/sedeRoutes.js';
import especialidadRoutes from './routes/especialidadRoutes.js';
import agendaRoutes from './routes/agendaRoutes.js';
import turnoRoutes from './routes/turnoRoutes.js';
import historialRoutes from './routes/historialRoutes.js';
import notificacionRoutes from './routes/notificacionRoutes.js';
import auditoriaRoutes from './routes/auditoriaRoutes.js';
import reporteRoutes from './routes/reporteRoutes.js';
import { enviarRespuesta } from './utils/respuesta.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/health', saludRoutes);
app.use('/coberturas', coberturaRoutes);
app.use('/auth', authRoutes);
app.use('/sedes', sedeRoutes);
app.use('/especialidades', especialidadRoutes);
app.use('/agenda', agendaRoutes);
app.use('/turnos', turnoRoutes);
app.use('/historial', historialRoutes);
app.use('/notificaciones', notificacionRoutes);
app.use('/auditoria', auditoriaRoutes);
app.use('/reportes', reporteRoutes);

app.use((req, res) => {
  enviarRespuesta(res, 404, null, 'Recurso no encontrado');
});

// Ultimo middleware y el unico de cuatro argumentos: Express lo reserva para los
// errores. Sin el, un body con JSON roto no llega a ningun controller (falla
// dentro de express.json()) y Express responde su pagina HTML por defecto, que
// es la unica respuesta del proyecto que no tiene la forma { codigo, estado, datos }.
app.use((error, req, res, next) => {
  if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return enviarRespuesta(res, 400, null, 'El cuerpo de la petición no es un JSON válido');
  }

  console.error('Error no controlado:', error);
  return enviarRespuesta(res, 500, null, 'Error interno del servidor');
});

export default app;
