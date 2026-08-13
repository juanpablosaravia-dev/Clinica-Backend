import { Router } from 'express';
import { verificarSalud } from '../controllers/saludController.js';

const router = Router();

router.get('/', verificarSalud);

export default router;
