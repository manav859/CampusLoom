import { PrismaClient } from "@prisma/client";

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
        url: dbUrl
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
