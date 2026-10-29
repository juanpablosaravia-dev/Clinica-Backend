import { Router } from 'express';
import { buscarPacientes } from '../controllers/pacienteController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';

const router = Router();

// ?busqueda=36000960 (DNI) o ?busqueda=Frig (apellido)
router.get('/', verificarToken, verificarRol('operador', 'medico', 'admin'), buscarPacientes);

export default router;
