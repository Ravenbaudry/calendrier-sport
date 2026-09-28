import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[api] Calendrier Sport à l'écoute sur le port ${config.port} (${config.env})`);
});

// Arrêt propre (docker stop envoie SIGTERM) : on termine les requêtes en cours puis on ferme la BDD.
function shutdown(signal) {
  console.log(`[api] ${signal} reçu, arrêt en cours…`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
