import { PrismaClient } from "../generated/master-client/index.js";
import { env } from "../config/env.js";

const globalForMasterPrisma = globalThis as typeof globalThis & {
  masterPrisma?: PrismaClient;
};

export function isMasterDbConfigured() {
  return Boolean(env.MASTER_DATABASE_URL);
}

export const masterPrisma =
  globalForMasterPrisma.masterPrisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (env.NODE_ENV !== "production") {
  globalForMasterPrisma.masterPrisma = masterPrisma;
}
