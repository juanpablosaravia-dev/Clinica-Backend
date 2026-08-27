import { Router } from 'express';
import { registrarHistorial, historialDePaciente } from '../controllers/historialController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';

const router = Router();

router.post('/', verificarToken, verificarRol('medico'), registrarHistorial);
router.get(
  '/paciente/:idPaciente',
  verificarToken,
  verificarRol('paciente', 'medico'),
  historialDePaciente
);

export default router;
