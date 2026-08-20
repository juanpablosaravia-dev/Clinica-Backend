import { Router } from 'express';
import {
  listarAgenda,
  crearAgenda,
  actualizarAgenda,
  eliminarAgenda,
} from '../controllers/agendaController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';

const router = Router();

router.use(verificarToken, verificarRol('medico', 'operador'));

router.get('/', listarAgenda);
router.post('/', crearAgenda);
router.put('/:id', actualizarAgenda);
router.delete('/:id', eliminarAgenda);

export default router;
