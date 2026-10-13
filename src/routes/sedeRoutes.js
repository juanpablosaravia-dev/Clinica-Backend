import { Router } from 'express';
import {
  listarSedes,
  crearSede,
  actualizarSede,
  eliminarSede,
} from '../controllers/sedeController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';
import { auditar } from '../middlewares/auditoria.js';

const router = Router();

// auditar() solo registra POST/PUT/DELETE que hayan salido bien; el GET pasa de largo.
router.use(verificarToken, verificarRol('admin'), auditar('sede'));

router.get('/', listarSedes);
router.post('/', crearSede);
router.put('/:id', actualizarSede);
router.delete('/:id', eliminarSede);

export default router;
