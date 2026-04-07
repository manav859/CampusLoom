import { getConfig } from './config/env.js';
import { buildApp } from './app.js';

async function start() {
  const config = getConfig();
  const app = await buildApp();

  try {
    await app.listen({
      port: config.PORT,
      host: '0.0.0.0', // Required for Docker / Render
    });

    app.log.info(
      `🚀 CampusLoom API running → http://localhost:${config.PORT} [${config.NODE_ENV}]`,
    );
  } catch (err) {
    app.log.fatal(err, '❌ Failed to start server');
    process.exit(1);
  }

  // --- Graceful shutdown ---
  const signals = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`${signal} received — shutting down gracefully`);
      await app.close();
      process.exit(0);
    });
  }
}

start();
