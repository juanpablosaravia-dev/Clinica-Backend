import { Router } from 'express';
import {
  turnosPorEspecialidad,
  turnosPorSede,
  rankingMedicos,
  tasaCancelacion,
} from '../controllers/reporteController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';

const router = Router();

router.use(verificarToken, verificarRol('admin'));

// Los cuatro aceptan el mismo filtro opcional: ?desde=2026-01-01&hasta=2026-12-31
router.get('/turnos-por-especialidad', turnosPorEspecialidad);
router.get('/turnos-por-sede', turnosPorSede);
router.get('/ranking-medicos', rankingMedicos);
router.get('/tasa-cancelacion', tasaCancelacion);

export default router;
