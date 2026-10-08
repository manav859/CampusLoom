"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { env } from "@/lib/env";
import { NotifyProvider } from "../super-admin/_lib/notify";
import { crmFetch, crmToken } from "./crmFetch";
import { clearResources, prefetch } from "./_lib/resource";
import { CrmSessionContext } from "./_lib/session";
import type { CrmUser } from "./_lib/types";

type Session = { accessToken: string; user: CrmUser };

const ICONS = {
  leads: "M17 20h5v-2a3 3 0 00-5.4-1.8M17 20H7m10 0v-2c0-.7-.1-1.3-.4-1.8M7 20H2v-2a3 3 0 015.4-1.8M7 20v-2c0-.7.1-1.3.4-1.8m0 0a5 5 0 019.2 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  payments: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  team: "M12 4.4a4 4 0 110 5.3M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.2M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  integrations: "M13.8 10.2a4 4 0 00-5.6 0l-4 4a4 4 0 105.6 5.6l1.1-1.1m-.7-4.9a4 4 0 005.6 0l4-4a4 4 0 00-5.6-5.6l-1.1 1.1"
} as const;

const NAV: Array<{ href: string; label: string; icon: keyof typeof ICONS; adminOnly?: boolean }> = [
  { href: "/crm", label: "Deals", icon: "leads" },
  { href: "/crm/payments", label: "Payments", icon: "payments" },
  { href: "/crm/team", label: "Team", icon: "team", adminOnly: true },
  { href: "/crm/integrations", label: "Integrations", icon: "integrations", adminOnly: true }
];

function isActive(pathname: string, href: string) {
  return href === "/crm" ? pathname === href || pathname.startsWith("/crm/deals") : pathname.startsWith(href);
}

/**
 * The sales CRM sits behind this shell: it owns the session, so every page
 * under /crm can fetch and assume it is signed in.
 */
export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <NotifyProvider>
      <Shell>{children}</Shell>
    </NotifyProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CrmUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    // The token lives in memory only; after a refresh, the httpOnly cookie
    // gets it back.
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${env.apiBaseUrl}/crm/session`, { credentials: "include", cache: "no-store" });
        if (!response.ok) return;
        const session = (await response.json().catch(() => null)) as Session | null;
        if (!cancelled && session?.accessToken) {
          crmToken.set(session.accessToken);
          setUser(session.user);
        }
      } catch {
        // No session — show the sign-in form.
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user) prefetch("/leads");
  }, [user]);

  function logout() {
    void fetch(`${env.apiBaseUrl}/crm/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    crmToken.clear();
    clearResources();
    setUser(null);
  }

  if (bootstrapping) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#151a26] text-slate-400">
        <p className="text-sm font-medium">Restoring session…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <LoginForm
        onSignedIn={(session) => {
          crmToken.set(session.accessToken);
          setUser(session.user);
        }}
      />
    );
  }

  return (
    <CrmSessionContext.Provider value={user}>
      <div className="min-h-screen bg-[#151a26] text-slate-900 lg:flex">
        <Sidebar onLogout={logout} user={user} />
        <main className="min-w-0 flex-1 lg:py-2 lg:pr-2">
          <div className="min-h-screen bg-slate-50 px-4 py-4 lg:min-h-[calc(100vh-1rem)] lg:rounded-xl lg:px-6 lg:py-5">
            <div className="mx-auto max-w-[1500px]">{children}</div>
          </div>
        </main>
      </div>
    </CrmSessionContext.Provider>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  );
}

function Sidebar({ user, onLogout }: { user: CrmUser; onLogout: () => void }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => !item.adminOnly || user.role === "ADMIN");

  return (
    <aside className="text-slate-300 lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:shrink-0">
      <div className="flex h-full flex-col gap-3 p-3 lg:gap-5 lg:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img alt="" className="h-8 w-8 rounded-lg bg-white object-contain" src="/logo-latest.png" />
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">SmartShala</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Sales CRM</p>
            </div>
          </div>
          <button className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 lg:hidden" onClick={onLogout} type="button">
            Logout
          </button>
        </div>

        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-0">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                className={`flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon path={ICONS[item.icon]} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden border-t border-white/10 pt-3 lg:block">
          <p className="truncate text-sm font-semibold text-white">{user.name}</p>
          <p className="text-xs text-slate-400">{user.role === "ADMIN" ? "Sales admin" : "Sales"}</p>
          <button className="mt-3 h-8 w-full rounded-md bg-white/10 text-xs font-semibold text-white hover:bg-white/15" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}

function LoginForm({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      onSignedIn(await crmFetch<Session>("/login", { method: "POST", body: JSON.stringify({ email, password }) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  const input = "h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#151a26] px-4">
      <form className="w-full max-w-sm rounded-xl bg-white p-6" onSubmit={login}>
        <img alt="SmartShala" className="h-10 w-10 rounded-lg object-contain" src="/logo-latest.png" />
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Sales CRM</h1>
        <p className="mt-0.5 text-sm text-slate-500">Sign in with your SmartShala team account.</p>
        <div className="mt-5 space-y-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Email
            <input autoComplete="username" className={input} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Password
            <input
              autoComplete="current-password"
              className={input}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button className="h-10 w-full rounded-md bg-blue-600 text-sm font-semibold text-white disabled:opacity-60" disabled={loading} type="submit">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </main>
  );
}
