import { Router } from 'express';
import {
  listarSedes,
  crearSede,
  actualizarSede,
  eliminarSede,
} from '../controllers/sedeController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';

const router = Router();

router.use(verificarToken, verificarRol('admin'));

router.get('/', listarSedes);
router.post('/', crearSede);
router.put('/:id', actualizarSede);
router.delete('/:id', eliminarSede);

export default router;
