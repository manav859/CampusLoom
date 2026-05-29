import cors from "cors";
import type { RequestHandler } from "express";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import pinoHttpModule from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { dbWarmup } from "./middleware/dbWarmup.js";
import { tenantMiddleware } from "./middleware/tenant.middleware.js";
import { apiRouter } from "./routes/index.js";
import { dbHealthHandler } from "./routes/health.js";
import { startDatabaseDeletionWorker } from "./services/databaseDeletion.service.js";
import { startTrialExpiryWorker } from "./services/trial.service.js";

function buildAllowedOrigins() {
  const configuredOrigins = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = new Set<string>([...configuredOrigins, env.FRONTEND_URL]);

  if (env.NODE_ENV === "development") {
    for (const port of [3000, 3001, 3002, 3003, 3004, 3005]) {
      allowedOrigins.add(`http://localhost:${port}`);
      allowedOrigins.add(`http://127.0.0.1:${port}`);
    }
  }

  return allowedOrigins;
}

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  const pinoHttp = pinoHttpModule as unknown as (options: { logger: typeof logger }) => RequestHandler;
  const allowedOrigins = buildAllowedOrigins();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(pinoHttp({ logger }));
  app.use(dbWarmup());

  app.get("/health/db", dbHealthHandler);
  app.use("/:schoolId/api", tenantMiddleware, apiRouter);
  app.use("/:schoolId/api/v1", tenantMiddleware, apiRouter);
  app.use("/api", apiRouter);
  app.use("/api/v1", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  startDatabaseDeletionWorker();
  startTrialExpiryWorker();

  return app;
}
