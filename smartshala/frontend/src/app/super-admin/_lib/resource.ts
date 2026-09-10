"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { superAdminFetch } from "../superAdminFetch";

/**
 * A small stale-while-revalidate cache for the super admin portal.
 *
 * Every screen reads through it by API path, so switching tabs or pages shows
 * the last data instantly and refreshes behind it, and two components asking
 * for the same path share one request. After a mutation, `invalidate` refreshes
 * only the paths that could have changed instead of reloading the whole page.
 */
type Entry = { data?: unknown; error?: string; updatedAt: number; inflight?: Promise<unknown> };

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const EMPTY: Entry = { updatedAt: 0 };

/** Data younger than this is shown without a background refresh. */
const FRESH_MS = 20_000;

function emit(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function write(key: string, patch: Partial<Entry>) {
  cache.set(key, { ...(cache.get(key) ?? EMPTY), ...patch });
  emit(key);
}

export function fetchResource<T>(key: string): Promise<T> {
  const current = cache.get(key);
  if (current?.inflight) return current.inflight as Promise<T>;

  const inflight = superAdminFetch<T>(key)
    .then((data) => {
      write(key, { data, error: undefined, updatedAt: Date.now(), inflight: undefined });
      return data;
    })
    .catch((error: unknown) => {
      write(key, { error: error instanceof Error ? error.message : "Request failed", inflight: undefined });
      throw error;
    });

  write(key, { inflight });
  return inflight;
}

/** Warm the cache for a screen the user is likely to open next. */
export function prefetch(key: string) {
  const entry = cache.get(key);
  if (entry?.data !== undefined && Date.now() - entry.updatedAt < FRESH_MS) return;
  fetchResource(key).catch(() => undefined);
}

/** Replace cached data directly — used to show a mutation's result immediately. */
export function setResource<T>(key: string, updater: (current: T | undefined) => T) {
  write(key, { data: updater(cache.get(key)?.data as T | undefined), updatedAt: Date.now() });
}

/**
 * "/billing/invoices" matches itself and its query variants ("?status=DUE");
 * a trailing slash ("/billing/") matches everything beneath it. So a school's
 * detail can be refreshed without also re-reading its slow /usage sub-path.
 */
function matches(key: string, prefix: string) {
  if (prefix.endsWith("/")) return key.startsWith(prefix);
  return key === prefix || key.startsWith(`${prefix}?`);
}

/**
 * Mark matching cached paths stale. Paths a mounted screen is showing refetch
 * now (in parallel, without blanking); the rest refetch when next opened.
 */
export function invalidate(...prefixes: string[]) {
  for (const key of cache.keys()) {
    if (!prefixes.some((prefix) => matches(key, prefix))) continue;
    cache.set(key, { ...(cache.get(key) ?? EMPTY), updatedAt: 0 });
    if (listeners.get(key)?.size) fetchResource(key).catch(() => undefined);
  }
}

export function clearResources() {
  cache.clear();
}

export function useResource<T>(key: string | null) {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!key) return () => undefined;
      const set = listeners.get(key) ?? new Set();
      set.add(listener);
      listeners.set(key, set);
      return () => set.delete(listener);
    },
    [key]
  );

  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? (cache.get(key) ?? EMPTY) : EMPTY),
    () => EMPTY
  );

  useEffect(() => {
    if (!key) return;
    const current = cache.get(key);
    if (current?.inflight) return;
    if (current?.data === undefined || Date.now() - current.updatedAt >= FRESH_MS) {
      fetchResource(key).catch(() => undefined);
    }
  }, [key]);

  const reload = useCallback(() => (key ? fetchResource<T>(key) : Promise.resolve(undefined)), [key]);

  return {
    data: entry.data as T | undefined,
    error: entry.data === undefined ? entry.error : undefined,
    /** First load only — cached data is never hidden behind a spinner. */
    isLoading: entry.data === undefined && !entry.error,
    isRefreshing: Boolean(entry.inflight) && entry.data !== undefined,
    reload
  };
}
