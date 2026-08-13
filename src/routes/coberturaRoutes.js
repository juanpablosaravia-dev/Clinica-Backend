import { Router } from 'express';
import { obtenerCoberturas } from '../controllers/coberturaController.js';

const router = Router();

router.get('/', obtenerCoberturas);

export default router;
