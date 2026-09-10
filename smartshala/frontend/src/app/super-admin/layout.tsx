"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { env } from "@/lib/env";
import { tokenStore } from "@/lib/tokenStore";
import { NotifyProvider } from "./_lib/notify";
import { clearResources, prefetch, useResource } from "./_lib/resource";
import type { RenewalRow } from "./_lib/types";
import { superAdminFetch } from "./superAdminFetch";

const NAV = [
  { href: "/super-admin", label: "Schools & users", hint: "Access, trials, staff accounts" },
  { href: "/super-admin/renewals", label: "Renewals", hint: "Terms ending soon or lapsed" },
  { href: "/super-admin/billing", label: "Billing", hint: "Plans, invoices, payments" },
  { href: "/super-admin/password-resets", label: "Password resets", hint: "Locked-out users" }
] as const;

function isActive(pathname: string, href: string) {
  return href === "/super-admin" ? pathname === href : pathname.startsWith(href);
}

/**
 * The super admin portal sits behind this shell: it owns the session, so every
 * page under /super-admin can fetch and assume it is signed in.
 */
export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <NotifyProvider>
      <Shell>{children}</Shell>
    </NotifyProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

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
        const response = await fetch(`${env.apiBaseUrl}/super-admin/session`, { credentials: "include", cache: "no-store" });
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

  useEffect(() => {
    if (!token) return;
    // Warm the screens people open first, so the first click is instant.
    prefetch("/schools");
    prefetch("/billing/summary");
    prefetch("/billing/plans");
  }, [token]);

  function logout() {
    // Clear the httpOnly session cookie server-side; ignore failures.
    void fetch(`${env.apiBaseUrl}/super-admin/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    tokenStore.clear();
    clearResources();
    setToken(null);
  }

  if (bootstrapping) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <p className="text-sm font-medium">Restoring session…</p>
      </main>
    );
  }

  if (!token) return <LoginForm onSignedIn={setToken} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <Sidebar onLogout={logout} />
      <main className="min-w-0 flex-1 px-4 py-4 lg:px-6 lg:py-5">
        <div className="mx-auto max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  // Shared with the pages that own these lists, so the badges cost nothing extra
  // and update the moment those pages change something.
  const resets = useResource<unknown[]>("/password-reset-requests");
  const renewals = useResource<RenewalRow[]>("/billing/renewals");
  const urgentRenewals = renewals.data?.filter((row) => row.daysLeft <= 7 && !row.paymentLink).length ?? 0;

  const badges: Partial<Record<(typeof NAV)[number]["href"], number>> = {
    "/super-admin/renewals": urgentRenewals,
    "/super-admin/password-resets": resets.data?.length ?? 0
  };

  return (
    <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col gap-3 p-3 lg:gap-4 lg:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Platform control</p>
            <p className="text-base font-semibold">Super admin</p>
          </div>
          <button className="h-8 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white lg:hidden" onClick={onLogout} type="button">
            Logout
          </button>
        </div>

        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-0">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const badge = badges[item.href] ?? 0;
            return (
              <Link
                className={`block shrink-0 rounded-md px-2.5 py-2 transition-colors ${active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                href={item.href}
                key={item.href}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{item.label}</span>
                  {badge > 0 ? (
                    <span className="rounded bg-amber-100 px-1.5 text-[11px] font-bold text-amber-800">{badge}</span>
                  ) : null}
                </span>
                <span className={`hidden text-[11px] lg:block ${active ? "text-slate-300" : "text-slate-500"}`}>{item.hint}</span>
              </Link>
            );
          })}
        </nav>

        <button className="hidden h-9 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 lg:block" onClick={onLogout} type="button">
          Logout
        </button>
      </div>
    </aside>
  );
}

function LoginForm({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      onSignedIn(result.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login");
    } finally {
      setLoading(false);
    }
  }

  const input = "h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5" onSubmit={login}>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Platform</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Super admin</h1>
        <div className="mt-5 space-y-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Email
            <input className={input} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Password
            <input className={input} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button className="h-10 w-full rounded-md bg-blue-600 text-sm font-semibold text-white disabled:opacity-60" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>
    </main>
  );
}
