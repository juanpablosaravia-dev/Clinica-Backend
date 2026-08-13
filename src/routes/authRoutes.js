import { Router } from 'express';
import { registrarPaciente } from '../controllers/authController.js';

const router = Router();

router.post('/registro', registrarPaciente);

export default router;
