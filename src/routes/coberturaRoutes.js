import { Router } from 'express';
import {
  obtenerCoberturas,
  crearCobertura,
  actualizarCobertura,
  eliminarCobertura,
} from '../controllers/coberturaController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';
import { auditar } from '../middlewares/auditoria.js';

const router = Router();

// A diferencia de sedes y especialidades, aca los middlewares van por ruta:
// el GET tiene que quedar publico y no puede pasar por verificarToken.
router.get('/', obtenerCoberturas);

router.post('/', verificarToken, verificarRol('admin'), auditar('cobertura'), crearCobertura);
router.put('/:id', verificarToken, verificarRol('admin'), auditar('cobertura'), actualizarCobertura);
router.delete('/:id', verificarToken, verificarRol('admin'), auditar('cobertura'), eliminarCobertura);

export default router;
