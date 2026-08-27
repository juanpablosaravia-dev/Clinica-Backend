import { Router } from 'express';
import {
  listarNotificaciones,
  marcarNotificacionLeida,
} from '../controllers/notificacionController.js';
import { verificarToken } from '../middlewares/verificarToken.js';

const router = Router();

// Sin restriccion de rol: cualquier usuario autenticado ve y marca sus
// propias notificaciones (el service ya filtra/valida por req.usuario.id).
router.use(verificarToken);

router.get('/', listarNotificaciones);
router.patch('/:id/leer', marcarNotificacionLeida);

export default router;
