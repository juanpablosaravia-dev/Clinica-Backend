import { Router } from 'express';
import { crearTurno, cancelarTurno, atenderTurno } from '../controllers/turnoController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';

const router = Router();

// Cada endpoint admite un conjunto distinto de roles, así que los middlewares
// van por ruta y no con un router.use() global como en sedes o agenda.
router.post('/', verificarToken, verificarRol('paciente', 'operador'), crearTurno);
router.patch('/:id/cancelar', verificarToken, verificarRol('paciente', 'operador', 'medico'), cancelarTurno);
router.patch('/:id/atender', verificarToken, verificarRol('medico'), atenderTurno);

export default router;
