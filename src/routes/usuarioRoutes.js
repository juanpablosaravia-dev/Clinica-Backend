import { Router } from 'express';
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
} from '../controllers/usuarioController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';
import { auditar } from '../middlewares/auditoria.js';

const router = Router();

// Gestion de usuarios: solo admin. Cada alta y modificacion queda en la auditoria.
router.use(verificarToken, verificarRol('admin'), auditar('usuario'));

router.get('/', listarUsuarios);
router.post('/', crearUsuario);
router.put('/:id', actualizarUsuario);

export default router;
