import { env } from "@/lib/env";

/**
 * The CRM's own bearer token, held in memory only. It is separate from the
 * school app's and the super admin's, so one browser can be signed in to all
 * three. A page refresh restores it from the httpOnly cookie via /crm/session.
 */
let accessToken: string | null = null;

export const crmToken = {
  get: () => accessToken,
  set: (token: string) => {
    accessToken = token;
  },
  clear: () => {
    accessToken = null;
  }
};

function headers(json: boolean) {
  const result = new Headers();
  if (json) result.set("Content-Type", "application/json");
  if (accessToken) result.set("Authorization", `Bearer ${accessToken}`);
  return result;
}

export async function crmFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}/crm${path}`, {
    ...options,
    headers: headers(true),
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

/** Same auth, for the PDF endpoints. */
export async function crmDownload(path: string, filename: string) {
  const response = await fetch(`${env.apiBaseUrl}/crm${path}`, { headers: headers(false), credentials: "include", cache: "no-store" });
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
