import { Router } from 'express';
import { listarMedicos } from '../controllers/medicoController.js';
import { verificarToken } from '../middlewares/verificarToken.js';

const router = Router();

// Cualquier usuario con sesion: lo usan el operador para cargar agenda, el
// medico para ver sus especialidades y el paciente al pedir turno.
// Filtros opcionales: ?id_especialidad=1&id_sede=2
router.get('/', verificarToken, listarMedicos);

export default router;
