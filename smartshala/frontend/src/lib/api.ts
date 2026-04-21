import { env } from "./env";
import type { SessionUser } from "@/types";

type ApiOptions = RequestInit & {
  auth?: boolean;
};

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (options.auth !== false && typeof window !== "undefined") {
    const token = window.localStorage.getItem("smartshala.accessToken");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? "Request failed");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const authApi = {
  register: (payload: { name: string; email: string; phone: string; password: string; schoolName?: string }) =>
    apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: SessionUser;
    }>("/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify(payload)
    }),
  login: (identifier: string, password: string) =>
    apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: SessionUser;
    }>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ identifier, password })
    }),
  me: () => apiFetch<{ user: SessionUser }>("/auth/me"),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" })
};
