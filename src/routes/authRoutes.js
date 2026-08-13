import { Router } from 'express';
import {
  registrarPaciente,
  iniciarSesion,
  obtenerPerfil,
} from '../controllers/authController.js';
import { verificarToken } from '../middlewares/verificarToken.js';

const router = Router();

router.post('/registro', registrarPaciente);
router.post('/login', iniciarSesion);

// Endpoint de prueba protegido por verificarToken.
router.get('/perfil', verificarToken, obtenerPerfil);

export default router;
