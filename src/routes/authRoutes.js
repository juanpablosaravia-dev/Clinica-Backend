import { Router } from 'express';
import {
  registrarPaciente,
  iniciarSesion,
  obtenerPerfil,
  actualizarMisDatos,
} from '../controllers/authController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';
import { auditar } from '../middlewares/auditoria.js';

const router = Router();

// El registro es publico, asi que no hay token: el middleware toma como autor
// del log al propio usuario recien creado (se registro a si mismo).
router.post('/registro', auditar('usuario'), registrarPaciente);
router.post('/login', iniciarSesion);
router.get('/perfil', verificarToken, obtenerPerfil);
// El paciente actualiza sus propios datos (email, contraseña, telefono y cobertura).
router.put('/perfil', verificarToken, verificarRol('paciente'), auditar('usuario'), actualizarMisDatos);

export default router;
