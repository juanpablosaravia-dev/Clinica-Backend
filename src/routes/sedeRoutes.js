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

// El listado lo necesita cualquier usuario con sesion (el paciente elige sede al
// pedir turno, el medico al cargar su agenda). Alta, modificacion y baja siguen
// siendo exclusivas del admin.
router.get('/', verificarToken, listarSedes);

// auditar() solo registra POST/PUT/DELETE que hayan salido bien.
router.post('/', verificarToken, verificarRol('admin'), auditar('sede'), crearSede);
router.put('/:id', verificarToken, verificarRol('admin'), auditar('sede'), actualizarSede);
router.delete('/:id', verificarToken, verificarRol('admin'), auditar('sede'), eliminarSede);

export default router;
