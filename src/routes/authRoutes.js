import { Router } from 'express';
import {
  registrarPaciente,
  iniciarSesion,
  obtenerPerfil,
} from '../controllers/authController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { auditar } from '../middlewares/auditoria.js';

const router = Router();

// El registro es publico, asi que no hay token: el middleware toma como autor
// del log al propio usuario recien creado (se registro a si mismo).
router.post('/registro', auditar('usuario'), registrarPaciente);
router.post('/login', iniciarSesion);

// Endpoint de prueba protegido por verificarToken.
router.get('/perfil', verificarToken, obtenerPerfil);

export default router;
