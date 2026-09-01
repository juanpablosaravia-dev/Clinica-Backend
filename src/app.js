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

export default app;
