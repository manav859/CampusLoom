import type { NextFunction, Request, Response } from "express";
import { prisma } from "../core/prisma.js";
import { logger } from "../config/logger.js";

/**
 * Fire an occasional lightweight database health check without blocking
 * request handling. Route-level retry wrappers handle stale connections;
 * this only keeps the pool warm in the background.
 */
export function dbWarmup() {
  let lastCheck = 0;
  const INTERVAL_MS = 30_000;
  let warmupPromise: Promise<void> | null = null;

  return (_req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();

    if (now - lastCheck < INTERVAL_MS) {
      return next();
    }

    if (!warmupPromise) {
      warmupPromise = (async () => {
        try {
          await prisma.$queryRaw`SELECT 1`;
          lastCheck = Date.now();
        } catch (error) {
          logger.warn({ err: error }, "DB warmup: connection check failed, reconnecting…");
          try {
            await prisma.$disconnect();
            await prisma.$connect();
            lastCheck = Date.now();
          } catch (reconnectError) {
            logger.error({ err: reconnectError }, "DB warmup: reconnect failed");
          }
        } finally {
          warmupPromise = null;
        }
      })();
    }

    next();
  };
}
