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

const TTL_MS = 60_000;
const MAX_BACKGROUND_PREFETCHES = 3;

function isFresh(entry: CacheEntry<any>): boolean {
  return Date.now() - entry.timestamp < TTL_MS;
}

function runNextPrefetch() {
  if (activePrefetches >= MAX_BACKGROUND_PREFETCHES) return;

  const next = prefetchQueue.shift();
  if (!next) return;

  activePrefetches++;
  next();
}

function enqueuePrefetch(key: string, fetcher: () => Promise<unknown>) {
  if (queuedPrefetches.has(key)) return;

  const existing = cache.get(key);
  if (existing && isFresh(existing)) return;

  queuedPrefetches.add(key);
  prefetchQueue.push(() => {
    setTimeout(() => {
      cachedFetch(key, fetcher)
        .catch(() => undefined)
        .finally(() => {
          queuedPrefetches.delete(key);
          activePrefetches--;
          runNextPrefetch();
        });
    }, 50);
  });
  runNextPrefetch();
}

export function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing && isFresh(existing)) {
    return existing.promise;
  }

  const promise = fetcher().then(
    (data) => {
      const entry = cache.get(key);
      if (entry && entry.promise === promise) {
        entry.resolved = true;
        entry.data = data;
      }
      return data;
    },
    (err) => {
      const entry = cache.get(key);
      if (entry && entry.promise === promise) {
        cache.delete(key);
      }
      throw err;
    }
  );

  cache.set(key, {
    promise,
    resolved: false,
    data: null,
    error: null,
    timestamp: Date.now(),
  });

  return promise;
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
  enqueuePrefetch("classes:list", () => classesApi.list());

  if (role === "PRINCIPAL" || role === "ADMIN") {
    enqueuePrefetch("classes:list:ADMIN", () => classesApi.list());
    enqueuePrefetch("dashboard", () => apiFetch("/dashboard"));
    enqueuePrefetch("fees:dashboard", () => feesApi.dashboard());
    enqueuePrefetch("fees:defaulters", () => feesApi.defaulters());
    enqueuePrefetch("fees:structures", () => apiFetch<any[]>("/fees/structures"));
    enqueuePrefetch("wa:logs", () => whatsappApi.logs());
    enqueuePrefetch("attendance:dashboard", () => attendanceApi.dashboard());
    enqueuePrefetch("attendance:classesToday", () => attendanceApi.classesTodayReport());
    enqueuePrefetch("students:list:limit=10&page=1", () => apiFetch<any>("/students?limit=10&page=1"));
    enqueuePrefetch("teachers:list", () => apiFetch<any>("/users/teachers?limit=100"));
    enqueuePrefetch("notifications:logs", () => whatsappApi.logs());
  }

  if (role === "TEACHER") {
    enqueuePrefetch("classes:list:SCOPED", () => classesApi.list());
    enqueuePrefetch("dashboard:teacher", () => apiFetch("/dashboard"));
    enqueuePrefetch("marks:context", () => marksApi.context());
    enqueuePrefetch("marks:exams", () => marksApi.exams());
    enqueuePrefetch("homework:context", () => homeworkApi.context());
    enqueuePrefetch("homework:assignments", () => homeworkApi.assignments());
    enqueuePrefetch("communication:context", () => communicationApi.context());
    enqueuePrefetch("communication:messages", () => communicationApi.messages());
  }

  if (role === "ACCOUNTANT") {
    enqueuePrefetch("classes:list:SCOPED", () => classesApi.list());
    enqueuePrefetch("fees:dashboard", () => feesApi.dashboard());
    enqueuePrefetch("fees:defaulters", () => feesApi.defaulters());
    enqueuePrefetch("fees:structures", () => apiFetch<any[]>("/fees/structures"));
  }
}
