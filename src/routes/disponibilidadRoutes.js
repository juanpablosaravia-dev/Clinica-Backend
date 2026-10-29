import { Router } from 'express';
import { fechasDisponibles, horariosDisponibles } from '../controllers/agendaController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';

const router = Router();

// Los usan el paciente al pedir turno y el operador al asignarlo.
router.use(verificarToken, verificarRol('paciente', 'operador'));

// ?id_medico=3&id_especialidad=1&id_sede=1
router.get('/fechas', fechasDisponibles);
// ?id_medico=3&id_especialidad=1&id_sede=1&fecha=2026-11-02
router.get('/horarios', horariosDisponibles);

export default router;
