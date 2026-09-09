"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { env } from "@/lib/env";
import { tokenStore } from "@/lib/tokenStore";
import { superAdminFetch } from "./superAdminFetch";

const NAV = [
  { href: "/super-admin", label: "Schools & users", hint: "Tenants, access, staff accounts" },
  { href: "/super-admin/billing", label: "Billing", hint: "Plans, invoices, payments" },
  { href: "/super-admin/password-resets", label: "Password resets", hint: "Requests from locked-out users" }
] as const;

function isActive(pathname: string, href: string) {
  return href === "/super-admin" ? pathname === href : pathname.startsWith(href);
}

/**
 * The whole super admin portal sits behind this shell: it owns the session, so
 * every page under /super-admin can just fetch and assume it is authenticated.
 */
export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingResets, setPendingResets] = useState(0);

  useEffect(() => {
    // The access token is held in memory only, so it is lost on a full page
    // refresh. Recover it from the httpOnly session cookie via /session.
    const storedToken = tokenStore.get();
    if (storedToken) {
      setToken(storedToken);
      setBootstrapping(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${env.apiBaseUrl}/super-admin/session`, {
          credentials: "include",
          cache: "no-store"
        });
        if (!response.ok) return;
        const data = (await response.json().catch(() => null)) as { accessToken?: string } | null;
        if (!cancelled && data?.accessToken) {
          tokenStore.set(data.accessToken);
          setToken(data.accessToken);
        }
      } catch {
        // No valid session — fall through to the login form.
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // The badge is the only place a pending reset is visible from another page,
  // so it follows navigation rather than being loaded once.
  const loadPendingResets = useCallback(async () => {
    if (!token) return;
    try {
      const requests = await superAdminFetch<unknown[]>("/password-reset-requests");
      setPendingResets(requests.length);
    } catch {
      // A badge is not worth surfacing an error for.
    }
  }, [token]);

  useEffect(() => {
    void loadPendingResets();
  }, [loadPendingResets, pathname]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await superAdminFetch<{ accessToken: string }>("/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      tokenStore.set(result.accessToken);
      setToken(result.accessToken);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    // Clear the httpOnly session cookie server-side; ignore failures.
    void fetch(`${env.apiBaseUrl}/super-admin/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    tokenStore.clear();
    setToken(null);
  }

  if (bootstrapping) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-[#5a6573]">
        <p className="text-sm font-semibold">Restoring session…</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5">
        <form className="w-full max-w-sm rounded-2xl border border-[#dce3ef] bg-white p-6 shadow-sm" onSubmit={login}>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5a6573]">Platform</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[#111827]">Super admin</h1>
          <div className="mt-6 space-y-4">
            <label className="grid gap-2 text-sm font-semibold text-[#1f2937]">
              Email
              <input className="min-h-11 rounded-lg border border-[#dce3ef] px-3 outline-none focus:border-[#2456e6]" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#1f2937]">
              Password
              <input className="min-h-11 rounded-lg border border-[#dce3ef] px-3 outline-none focus:border-[#2456e6]" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            </label>
            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
            <button className="min-h-11 w-full rounded-lg bg-[#2456e6] px-4 text-sm font-bold text-white disabled:opacity-60" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#111827] lg:flex">
      <aside className="border-b border-[#dce3ef] bg-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col gap-6 p-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#64748b]">Platform control</p>
            <p className="mt-1 text-lg font-semibold">Super admin</p>
          </div>

          <nav className="flex gap-2 overflow-x-auto lg:flex-1 lg:flex-col lg:overflow-visible">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  className={`block shrink-0 rounded-lg px-3 py-2.5 transition lg:shrink ${
                    active ? "bg-[#111827] text-white" : "text-[#334155] hover:bg-[#f1f5f9]"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{item.label}</span>
                    {item.href.endsWith("password-resets") && pendingResets > 0 ? (
                      <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[11px] font-bold text-[#c2410c]">
                        {pendingResets}
                      </span>
                    ) : null}
                  </span>
                  <span className={`mt-0.5 hidden text-[11px] lg:block ${active ? "text-[#cbd5e1]" : "text-[#64748b]"}`}>
                    {item.hint}
                  </span>
                </Link>
              );
            })}
          </nav>

          <button
            className="hidden min-h-10 rounded-lg bg-[#111827] px-4 text-sm font-semibold text-white lg:block"
            onClick={logout}
            type="button"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-5 flex justify-end lg:hidden">
            <button className="min-h-10 rounded-lg bg-[#111827] px-4 text-sm font-semibold text-white" onClick={logout} type="button">
              Logout
            </button>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
