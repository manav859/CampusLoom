"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SessionUser } from "@/types";
import { authApi } from "@/lib/api";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

function isAdminRole(role: SessionUser["role"]) {
  return role === "PRINCIPAL" || role === "ADMIN";
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

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
    return <div className="flex min-h-screen items-center justify-center bg-canvas text-neutral-600">Loading SmartShala...</div>;
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar role={user.role} />
      <div className="min-w-0 flex-1">
        <Topbar user={user} />
        <nav className="flex gap-2 overflow-x-auto border-b border-line bg-panel px-4 py-2 md:hidden">
          {(isAdminRole(user.role)
            ? [
                ["Dashboard", "/dashboard"],
                ["Attendance", "/dashboard/attendance"],
                ["Fees", "/fees"],
                ["Students", "/students"],
                ["Alerts", "/analytics"]
              ]
            : [
                ["Dashboard", "/teacher"],
                ["Attendance", "/attendance"],
                ["Students", "/students"],
                ["Reports", "/attendance/reports"]
              ]
          ).map(([label, href]) => (
            <Link key={href} className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium" href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
