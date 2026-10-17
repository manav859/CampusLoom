import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

type CachedClient = {
  client: PrismaClient;
  lastUsedAt: number;
};

const MAX_CLIENTS = 50;
const clients = new Map<string, CachedClient>();

function evictOldestClient() {
  const oldest = [...clients.entries()].sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt)[0];
  if (!oldest) return;

  clients.delete(oldest[0]);
  void oldest[1].client.$disconnect();
}

/**
 * Prisma defaults each client to a pool of (cpus * 2 + 1) connections. With up
 * to MAX_CLIENTS tenants cached that overruns a self-hosted Postgres
 * `max_connections` long before the cache is full, so cap every tenant pool.
 * A URL that already states a limit is left alone.
 */
function withConnectionLimit(dbUrl: string) {
  const limit = env.TENANT_DB_CONNECTION_LIMIT;
  if (limit <= 0) return dbUrl;

  try {
    const url = new URL(dbUrl);
    if (url.searchParams.has("connection_limit")) return dbUrl;
    url.searchParams.set("connection_limit", String(limit));
    return url.toString();
  } catch {
    return dbUrl;
  }
}

export function getTenantPrismaClient(dbUrl: string) {
  const current = clients.get(dbUrl);
  if (current) {
    current.lastUsedAt = Date.now();
    return current.client;
  }

  if (clients.size >= MAX_CLIENTS) evictOldestClient();

  const client = new PrismaClient({
    datasources: {
      db: {
        url: withConnectionLimit(dbUrl)
      }
    },
    log: ["error", "warn"]
  });

  clients.set(dbUrl, { client, lastUsedAt: Date.now() });
  return client;
}

export async function disconnectTenantClients() {
  const allClients = [...clients.values()].map((entry) => entry.client);
  clients.clear();
  await Promise.allSettled(allClients.map((client) => client.$disconnect()));
}
