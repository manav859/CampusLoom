import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDatabase, disconnectDatabase } from "./core/prisma.js";

async function bootstrap() {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`SmartShala API listening on http://localhost:${env.PORT}/api and /api/v1`);
  });

  // Initial connection is now handled entirely by the dbWarmup middleware
  // to avoid concurrent connection attempts that can deadlock Prisma.

  const shutdown = async () => {
    logger.info("Shutting down SmartShala API");
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
