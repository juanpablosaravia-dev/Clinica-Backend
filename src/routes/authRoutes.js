import { Router } from 'express';
import {
  registrarPaciente,
  iniciarSesion,
  obtenerPerfil,
  verificarAccesoAdmin,
} from '../controllers/authController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';

const router = Router();

router.post('/registro', registrarPaciente);
router.post('/login', iniciarSesion);

// Endpoint de prueba protegido por verificarToken.
router.get('/perfil', verificarToken, obtenerPerfil);

// Endpoint de prueba protegido por verificarRol (verificarToken siempre primero).
router.get('/admin', verificarToken, verificarRol('admin'), verificarAccesoAdmin);

export default router;
