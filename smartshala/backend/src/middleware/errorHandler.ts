import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { logger } from "../config/logger.js";
import { AppError } from "../core/errors.js";
import { isRetryableError } from "../core/prisma.js";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid request input", details: error.flatten() }
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: { code: error.code, message: error.message, details: error.details }
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: { code: "UNIQUE_CONSTRAINT", message: "Duplicate record", details: error.meta }
      });
    }
  }

  // Connection / pool errors — return 503 so frontend can auto-retry
  if (isRetryableError(error)) {
    logger.warn({ error }, "Database connection error — returning 503");
    return res.status(503).json({
      error: { code: "SERVICE_UNAVAILABLE", message: "Database temporarily unavailable, please retry" }
    });
  }

  logger.error({ error }, "Unhandled request error");
  return res.status(500).json({
    error: { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong" }
  });
}

