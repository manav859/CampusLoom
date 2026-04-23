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
import { apiRouter } from "./routes/index.js";

function buildAllowedOrigins() {
  const configuredOrigins = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = new Set<string>([...configuredOrigins, env.FRONTEND_URL]);

  if (env.NODE_ENV === "development") {
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://localhost:3001");
    allowedOrigins.add("http://127.0.0.1:3000");
    allowedOrigins.add("http://127.0.0.1:3001");
  }

  return allowedOrigins;
}

export function createApp() {
  const app = express();
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

  app.use("/api", apiRouter);
  app.use("/api/v1", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
