/**
 * Prefetch cache. It stores pending promises keyed by endpoint path so pages can
 * reuse work that was started just after authentication.
 */

import { apiFetch, attendanceApi, classesApi, communicationApi, feesApi, homeworkApi, marksApi, whatsappApi } from "./api";

type CacheEntry<T> = {
  promise: Promise<T>;
  resolved: boolean;
  data: T | null;
  error: Error | null;
  timestamp: number;
};

const cache = new Map<string, CacheEntry<any>>();
const queuedPrefetches = new Set<string>();
const prefetchQueue: Array<() => void> = [];
let activePrefetches = 0;

const MAX_BACKGROUND_PREFETCHES = 3;

function isFresh(entry: CacheEntry<any>): boolean {
  return Boolean(entry);
}

function normalizeKeys(key: string | string[]) {
  return Array.isArray(key) ? key : [key];
}

function scheduleBackground(callback: () => void) {
  const browserWindow =
    typeof globalThis.window === "undefined"
      ? undefined
      : (globalThis.window as Window & {
          requestIdleCallback?: (handler: () => void, options?: { timeout: number }) => number;
        });

  if (!browserWindow) {
    globalThis.setTimeout(callback, 100);
    return;
  }

  if (browserWindow.requestIdleCallback) {
    browserWindow.requestIdleCallback(callback, { timeout: 800 });
    return;
  }

  globalThis.setTimeout(callback, 100);
}

function runNextPrefetch() {
  if (activePrefetches >= MAX_BACKGROUND_PREFETCHES) return;

  const next = prefetchQueue.shift();
  if (!next) return;

  activePrefetches++;
  next();
}

function enqueuePrefetch(key: string | string[], fetcher: () => Promise<unknown>) {
  const keys = normalizeKeys(key);
  if (keys.some((item) => queuedPrefetches.has(item))) return;

  const existing = keys.map((item) => cache.get(item)).find((entry): entry is CacheEntry<any> => Boolean(entry && isFresh(entry)));
  if (existing) {
    keys.forEach((item) => cache.set(item, existing));
    return;
  }

  keys.forEach((item) => queuedPrefetches.add(item));
  prefetchQueue.push(() => {
    scheduleBackground(() => {
      cachedFetchMany(keys, fetcher)
        .catch(() => undefined)
        .finally(() => {
          keys.forEach((item) => queuedPrefetches.delete(item));
          activePrefetches--;
          runNextPrefetch();
        });
    });
  });
  runNextPrefetch();
}

export function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  return cachedFetchMany([key], fetcher);
}

export function cachedFetchMany<T>(keys: string[], fetcher: () => Promise<T>): Promise<T> {
  const existing = keys.map((key) => cache.get(key)).find((entry): entry is CacheEntry<T> => Boolean(entry && isFresh(entry)));
  if (existing) {
    keys.forEach((key) => cache.set(key, existing));
    return existing.promise;
  }

  const promise = fetcher().then(
    (data) => {
      const entry = cache.get(keys[0]);
      if (entry && entry.promise === promise) {
        entry.resolved = true;
        entry.data = data;
        entry.timestamp = Date.now();
        keys.forEach((key) => cache.set(key, entry));
      }
      return data;
    },
    (err) => {
      keys.forEach((key) => {
        const entry = cache.get(key);
        if (entry && entry.promise === promise) cache.delete(key);
      });
      throw err;
    }
  );

  const entry: CacheEntry<T> = {
    promise,
    resolved: false,
    data: null,
    error: null,
    timestamp: Date.now(),
  };
  keys.forEach((key) => cache.set(key, entry));

  return promise;
}

export function getCachedData<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry?.resolved) return null;
  return entry.data;
}

export function invalidateCache(key: string) {
  cache.delete(key);
}

export function invalidateCachePrefix(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function clearCache() {
  cache.clear();
  queuedPrefetches.clear();
  prefetchQueue.length = 0;
}

export function prefetchForRole(role: string) {
  if (role === "PRINCIPAL" || role === "ADMIN") {
    enqueuePrefetch(["classes:list", "classes:list:ADMIN"], () => classesApi.list());
    enqueuePrefetch("dashboard", () => apiFetch("/dashboard"));
    enqueuePrefetch("fees:structures", () => apiFetch<any[]>("/fees/structures"));
    enqueuePrefetch("notifications:logs", () => whatsappApi.logs());
    enqueuePrefetch("attendance:dashboard", () => attendanceApi.dashboard());
    enqueuePrefetch("attendance:classesToday", () => attendanceApi.classesTodayReport());
    enqueuePrefetch("students:list:limit=10&page=1", () => apiFetch<any>("/students?limit=10&page=1"));
    enqueuePrefetch("teachers:list", () => apiFetch<any>("/users/teachers?limit=100"));
  }

  if (role === "TEACHER") {
    enqueuePrefetch(["classes:list", "classes:list:SCOPED"], () => classesApi.list());
    enqueuePrefetch("dashboard:teacher", () => apiFetch("/dashboard"));
    enqueuePrefetch("marks:context", () => marksApi.context());
    enqueuePrefetch("marks:exams", () => marksApi.exams());
    enqueuePrefetch("homework:context", () => homeworkApi.context());
    enqueuePrefetch("homework:assignments", () => homeworkApi.assignments());
    enqueuePrefetch("communication:context", () => communicationApi.context());
    enqueuePrefetch("communication:messages", () => communicationApi.messages());
  }

  if (role === "ACCOUNTANT") {
    enqueuePrefetch(["classes:list", "classes:list:SCOPED"], () => classesApi.list());
    enqueuePrefetch("fees:dashboard", () => feesApi.dashboard());
    enqueuePrefetch("fees:defaulters", () => feesApi.defaulters());
    enqueuePrefetch("fees:structures", () => apiFetch<any[]>("/fees/structures"));
  }
}
