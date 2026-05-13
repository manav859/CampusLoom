import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDatabase, disconnectDatabase } from "./core/prisma.js";
import { startDbWarmupScheduler, stopDbWarmupScheduler } from "./middleware/dbWarmup.js";

async function bootstrap() {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`SmartShala API listening on http://localhost:${env.PORT}/api and /api/v1`);
  });

  void connectDatabase()
    .then(() => {
      logger.info("Database connection ready");
      startDbWarmupScheduler();
    })
    .catch((error) => {
      logger.warn({ err: error }, "Initial database connection failed; scheduled warmup will keep retrying");
      startDbWarmupScheduler();
    });

  const shutdown = async () => {
    logger.info("Shutting down SmartShala API");
    stopDbWarmupScheduler();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  logger.error({ error }, "Fatal error during bootstrap");
  process.exit(1);
});
