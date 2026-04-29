import type { NextFunction, Request, Response } from "express";
import { prisma } from "../core/prisma.js";
import { logger } from "../config/logger.js";

/**
 * Middleware that ensures the database connection is alive before
 * processing a request. On Render free tier, Postgres sleeps after
 * inactivity and the first request after wake-up would fail with a
 * stale connection error. This middleware fires a lightweight `SELECT 1`
 * to warm the pool. If the connection is already alive the overhead
 * is < 1ms; if not it triggers pool reconnection transparently.
 */
export function dbWarmup() {
  let lastCheck = 0;
  const INTERVAL_MS = 30_000; // only check every 30 seconds

  return async (_req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();

    // Skip if we recently verified the connection
    if (now - lastCheck < INTERVAL_MS) {
      return next();
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      lastCheck = now;
    } catch (error) {
      logger.warn({ err: error }, "DB warmup: connection check failed, reconnecting…");
      try {
        await prisma.$disconnect();
        await prisma.$connect();
        lastCheck = now;
      } catch (reconnectError) {
        logger.error({ err: reconnectError }, "DB warmup: reconnect failed");
        // Let the request proceed — it will fail naturally and the error handler will catch it
      }
    }

    next();
  };
}
