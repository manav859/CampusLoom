import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

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

