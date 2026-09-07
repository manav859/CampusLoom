import { env } from "@/lib/env";
import { tokenStore } from "@/lib/tokenStore";

/**
 * Super admin calls are bearer-only and never tenant-prefixed, so they bypass
 * the tenant-aware apiFetch in lib/api.ts.
 */
export async function superAdminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${env.apiBaseUrl}/super-admin${path}`, {
    ...options,
    headers,
    credentials: "include",
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? "Request failed");
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Same auth, but for endpoints that answer with a file rather than JSON. */
export async function superAdminDownload(path: string, filename: string) {
  const headers = new Headers();
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${env.apiBaseUrl}/super-admin${path}`, {
    headers,
    credentials: "include",
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Download failed");

  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
