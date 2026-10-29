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

// Mismo criterio que sedes: el listado es para cualquier usuario con sesion y
// el ABM queda para el admin.
router.get('/', verificarToken, listarEspecialidades);

router.post('/', verificarToken, verificarRol('admin'), auditar('especialidad'), crearEspecialidad);
router.put('/:id', verificarToken, verificarRol('admin'), auditar('especialidad'), actualizarEspecialidad);
router.delete('/:id', verificarToken, verificarRol('admin'), auditar('especialidad'), eliminarEspecialidad);

export default router;
