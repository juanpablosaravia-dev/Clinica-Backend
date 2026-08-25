import 'dotenv/config';
import app from './app.js';
import { asegurarRestricciones } from './database/migraciones.js';

const PORT = process.env.PORT || 3000;

try {
  await asegurarRestricciones();
} catch (error) {
  console.error('No se pudieron aplicar las migraciones de la base:', error.message);
}

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
