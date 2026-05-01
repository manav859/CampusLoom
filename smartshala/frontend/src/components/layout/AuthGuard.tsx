"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionUser } from "@/types";
import { authApi } from "@/lib/api";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      const token = window.localStorage.getItem("smartshala.accessToken");
      if (!token) {
        router.replace("/login");
        return;
      }

      const storedUser = window.localStorage.getItem("smartshala.user");
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser) as SessionUser);
        } catch {
          window.localStorage.removeItem("smartshala.user");
        }
      }

      try {
        const result = await authApi.me();
        if (cancelled) return;
        setUser(result.user);
        window.localStorage.setItem("smartshala.user", JSON.stringify(result.user));
        setReady(true);
      } catch {
        window.localStorage.removeItem("smartshala.accessToken");
        window.localStorage.removeItem("smartshala.refreshToken");
        window.localStorage.removeItem("smartshala.user");
        router.replace("/login");
      }
    }

    hydrateSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 bg-white">
        <div className="glass-card w-full max-w-sm p-10 text-center animate-fade-in border-none shadow-none">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0071e3] shadow-xl shadow-blue-500/20">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24">
              <path d="M12 6.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" stroke="currentColor" strokeWidth="2" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[12px] font-bold uppercase tracking-[0.25em] text-[#86868b]">SmartShala</p>
          <p className="mt-4 text-xl font-bold text-[#000000]">Setting up your workspace…</p>
          <div className="mx-auto mt-8 h-1 w-12 overflow-hidden rounded-full bg-[#f5f5f7]">
            <div className="h-full w-full animate-progress bg-[#0071e3]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--apple-bg)]">
      {/* Subtle ambient background — Apple style */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-24 h-[500px] w-[500px] rounded-full bg-[#0071e3]/[0.03] blur-[120px]" />
        <div className="absolute -right-24 top-40 h-[400px] w-[400px] rounded-full bg-[#34c759]/[0.03] blur-[120px]" />
        <div className="absolute -bottom-32 left-1/3 h-[500px] w-[500px] rounded-full bg-[#af52de]/[0.03] blur-[120px]" />
      </div>

      <div className="relative flex min-h-screen">
        <Sidebar onClose={() => setSidebarOpen(false)} open={sidebarOpen} role={user.role} />
        <div className="min-w-0 flex-1 flex flex-col">
          <Topbar onMenuClick={() => setSidebarOpen(true)} user={user} />
          <main className="flex-1 px-4 pb-8 pt-3 sm:px-5 lg:px-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
