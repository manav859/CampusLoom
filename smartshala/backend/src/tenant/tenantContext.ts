import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@prisma/client";

export type TenantContext = {
  schoolId: string;
  schoolName: string;
  dbName: string;
  prisma: PrismaClient;
};

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(context: TenantContext, callback: () => T) {
  return storage.run(context, callback);
}

export function getTenantContext() {
  return storage.getStore();
}
