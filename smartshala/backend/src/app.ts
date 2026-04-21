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

export function createApp() {
  const app = express();
  const pinoHttp = pinoHttpModule as unknown as (options: { logger: typeof logger }) => RequestHandler;

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
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
