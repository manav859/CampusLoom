import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { getTenantContext } from "../tenant/tenantContext.js";

const log = env.PRISMA_LOG_LEVEL.split(",").map((item) => item.trim()).filter(Boolean) as (
  | "query"
  | "info"
  | "warn"
  | "error"
)[];

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

// Centralized DB client entrypoint. Keep this isolated so a future tenant-aware
// data layer can wrap Prisma without changing feature modules.
const defaultPrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = defaultPrisma;
}

function activePrisma() {
  return getTenantContext()?.prisma ?? defaultPrisma;
}

// Proxy preserves the old singleton import while allowing tenant routes to
// transparently use the request-scoped tenant Prisma Client.
export const prisma = new Proxy(defaultPrisma, {
  get(_target, prop, receiver) {
    const value = Reflect.get(activePrisma(), prop, receiver);
    return typeof value === "function" ? value.bind(activePrisma()) : value;
  }
}) as PrismaClient;

export async function connectDatabase() {
  await defaultPrisma.$connect();
}

export async function disconnectDatabase() {
  await defaultPrisma.$disconnect();
}

/**
 * Check whether an error is a transient Prisma connection error that
 * should be retried, including stale pooled connections from managed Postgres.
 */
const RETRYABLE_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

export function isRetryableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_PRISMA_CODES.has(error.code);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("connection") ||
      msg.includes("timed out") ||
      msg.includes("econnreset") ||
      msg.includes("epipe")
    );
  }

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
 * Execute a database operation with automatic retry on transient connection
 * errors. After a failed attempt, reconnect to clear stale pooled connections.
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
          `Retryable DB error on attempt ${attempt}/${maxAttempts}, reconnecting...`
        );

        try {
          await prisma.$disconnect();
          await prisma.$connect();
        } catch {
          // The next attempt will surface any remaining connection problem.
        }

        await new Promise((resolve) => setTimeout(resolve, attempt * 200));
        continue;
      }

      throw error;
    }
  }

  throw new Error(`${label}: exhausted ${maxAttempts} attempts`);
}
