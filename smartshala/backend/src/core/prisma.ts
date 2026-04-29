import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const log = env.PRISMA_LOG_LEVEL.split(",").map((item) => item.trim()).filter(Boolean) as (
  | "query"
  | "info"
  | "warn"
  | "error"
)[];

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase() {
  await prisma.$connect();
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}

/**
 * Check whether an error is a transient Prisma connection error that
 * should be retried (e.g. stale pooled connection after Render cold-start).
 *
 * Covers:
 *  - P1001  Can't reach database server
 *  - P1002  Database server reached but timed out
 *  - P1008  Operations timed out
 *  - P1017  Server has closed the connection
 *  - P2024  Timed out fetching a new connection from the pool
 *  - Generic connection-reset / ECONNRESET / EPIPE errors
 */
const RETRYABLE_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

export function isRetryableError(error: unknown): boolean {
  // Prisma known request errors with specific codes
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_PRISMA_CODES.has(error.code);
  }

  // Prisma initialization / connection errors (thrown when pool can't connect)
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  // Prisma unhandled request errors (connection-level failures during a query)
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return true;
  }

  // Generic Node.js network errors (ECONNRESET, EPIPE, ETIMEDOUT, etc.)
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("econnreset") ||
      msg.includes("econnrefused") ||
      msg.includes("epipe") ||
      msg.includes("etimedout") ||
      msg.includes("connection") ||
      msg.includes("timed out") ||
      msg.includes("server has closed the connection") ||
      msg.includes("can't reach database")
    );
  }

  return false;
}

/**
 * Execute a database operation with automatic retry on transient connection errors.
 * After a failed attempt, forces a reconnect to clear stale pooled connections.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  { maxAttempts = 3, label = "db-operation" } = {}
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const retryable = isRetryableError(error);

      if (attempt < maxAttempts && retryable) {
        logger.warn(
          { err: error, attempt, maxAttempts, label },
          `Retryable DB error on attempt ${attempt}/${maxAttempts}, reconnecting…`
        );

        // Force pool to drop stale connections and re-establish
        try {
          await prisma.$disconnect();
          await prisma.$connect();
        } catch {
          // Ignore reconnect errors — next attempt will try again
        }

        // Brief backoff: 200ms, 600ms
        await new Promise((resolve) => setTimeout(resolve, attempt * 200));
        continue;
      }

      throw error;
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error(`${label}: exhausted ${maxAttempts} attempts`);
}
