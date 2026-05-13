import type { NextFunction, Request, Response } from "express";
import { prisma } from "../core/prisma.js";
import { logger } from "../config/logger.js";

const INTERVAL_MS = 30_000;
let lastCheck = 0;
let warmupPromise: Promise<void> | null = null;
let warmupTimer: NodeJS.Timeout | null = null;

async function runWarmup(reason: string) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    lastCheck = Date.now();
  } catch (error) {
    logger.warn({ err: error, reason }, "DB warmup: connection check failed, reconnecting...");
    try {
      await prisma.$disconnect();
      await prisma.$connect();
      lastCheck = Date.now();
    } catch (reconnectError) {
      logger.error({ err: reconnectError, reason }, "DB warmup: reconnect failed");
    }
  }
}

export function triggerDbWarmup(reason = "manual") {
  if (!warmupPromise) {
    warmupPromise = runWarmup(reason).finally(() => {
      warmupPromise = null;
    });
  }

  return warmupPromise;
}

export function startDbWarmupScheduler() {
  if (warmupTimer) return;

  void triggerDbWarmup("startup");
  warmupTimer = setInterval(() => {
    void triggerDbWarmup("scheduled");
  }, INTERVAL_MS);
  warmupTimer.unref?.();
}

export function stopDbWarmupScheduler() {
  if (!warmupTimer) return;
  clearInterval(warmupTimer);
  warmupTimer = null;
}

/**
 * Fire an occasional lightweight database health check without blocking
 * request handling. Route-level retry wrappers handle stale connections;
 * this only keeps the pool warm in the background.
 */
export function dbWarmup() {
  return (_req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();

    if (now - lastCheck < INTERVAL_MS) {
      return next();
    }

    void triggerDbWarmup("request");
    next();
  };
}
