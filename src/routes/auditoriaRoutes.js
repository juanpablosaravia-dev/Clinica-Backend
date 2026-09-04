import { Router } from 'express';
import { listarLogs } from '../controllers/auditoriaController.js';
import { verificarToken } from '../middlewares/verificarToken.js';
import { verificarRol } from '../middlewares/verificarRol.js';

const router = Router();

router.use(verificarToken, verificarRol('admin'));

// Filtros opcionales por query string: ?id_usuario=4&entidad=sede&desde=2026-01-01&hasta=2026-12-31
router.get('/', listarLogs);

export default router;
