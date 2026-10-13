import { Router } from 'express';
import {
  listarEspecialidades,
  crearEspecialidad,
  actualizarEspecialidad,
  eliminarEspecialidad,
} from '../controllers/especialidadController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';
import { auditar } from '../middlewares/auditoria.js';

const router = Router();

// auditar() solo registra POST/PUT/DELETE que hayan salido bien; el GET pasa de largo.
router.use(verificarToken, verificarRol('admin'), auditar('especialidad'));

router.get('/', listarEspecialidades);
router.post('/', crearEspecialidad);
router.put('/:id', actualizarEspecialidad);
router.delete('/:id', eliminarEspecialidad);

export default router;
