import { Router } from 'express';
import {
  obtenerCoberturas,
  crearCobertura,
  actualizarCobertura,
  eliminarCobertura,
} from '../controllers/coberturaController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';

const router = Router();

// El listado queda publico: lo reutiliza el registro de pacientes (semana 1).
router.get('/', obtenerCoberturas);

router.post('/', verificarToken, verificarRol('admin'), crearCobertura);
router.put('/:id', verificarToken, verificarRol('admin'), actualizarCobertura);
router.delete('/:id', verificarToken, verificarRol('admin'), eliminarCobertura);

export default router;
