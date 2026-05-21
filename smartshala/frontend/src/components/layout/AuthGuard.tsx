"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Role, SessionUser } from "@/types";
import { authApi } from "@/lib/api";
import { clearCache, prefetchForRole } from "@/lib/prefetchCache";
import { schoolIdFromPath, withResolvedSchoolPath, withSchoolPath } from "@/lib/tenant";
import { PlatformTranslator } from "./PlatformLanguage";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const teacherAllowedPrefixes = ["/teacher", "/classes", "/attendance", "/students"];
const accountantAllowedPrefixes = ["/fees", "/students"];
const parentAllowedPrefixes = ["/students"];

function isAdminRole(role: Role) {
  return role === "PRINCIPAL" || role === "ADMIN";
}

function roleHome(role: Role) {
  if (role === "TEACHER") return "/teacher";
  if (role === "ACCOUNTANT") return "/fees";
  if (role === "PARENT") return "/students";
  return "/dashboard";
}

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function withoutSchoolPath(pathname: string) {
  const schoolId = schoolIdFromPath(pathname);
  if (!schoolId) return pathname;
  const withoutId = pathname.replace(`/${schoolId}`, "");
  return withoutId || "/";
}

function isPathAllowedForRole(pathname: string, role: Role) {
  if (isAdminRole(role)) return true;
  if (matchesPrefix(pathname, "/students/new")) return false;
  if (matchesPrefix(pathname, "/classes/new")) return false;
  if (role === "TEACHER") {
    if (matchesPrefix(pathname, "/attendance/reports")) return false;
    return teacherAllowedPrefixes.some((prefix) => matchesPrefix(pathname, prefix));
  }
  if (role === "ACCOUNTANT") return accountantAllowedPrefixes.some((prefix) => matchesPrefix(pathname, prefix));
  if (role === "PARENT") return parentAllowedPrefixes.some((prefix) => matchesPrefix(pathname, prefix));
  return false;
}

function WorkspaceSkeleton() {
  return (
    <div className="min-h-screen bg-white px-4 py-5">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl overflow-hidden rounded-[20px] border border-[#e8e8ed] bg-[#f5f5f7]">
        <div className="hidden w-64 border-r border-[#e1e1e6] bg-white p-5 md:block">
          <div className="h-8 w-32 rounded-full bg-[#e8e8ed]" />
          <div className="mt-8 space-y-3">
            <div className="h-10 rounded-xl bg-[#f5f5f7]" />
            <div className="h-10 rounded-xl bg-[#f5f5f7]" />
            <div className="h-10 rounded-xl bg-[#f5f5f7]" />
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex h-16 items-center justify-between border-b border-[#e1e1e6] bg-white px-5">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#86868b]">SmartShala</p>
              <p className="mt-1 text-[17px] font-semibold text-[#1d1d1f]">Loading workspace</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-[#e8e8ed]" />
          </div>
          <div className="grid flex-1 content-start gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="h-28 rounded-2xl bg-white" />
            <div className="h-28 rounded-2xl bg-white" />
            <div className="h-28 rounded-2xl bg-white" />
            <div className="h-64 rounded-2xl bg-white sm:col-span-2" />
            <div className="h-64 rounded-2xl bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);

  const handleToggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen((v) => !v);
    } else {
      setSidebarPinned((v) => !v);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      const token = window.localStorage.getItem("smartshala.accessToken");
      if (!token) {
        router.replace(withSchoolPath("/login", pathname));
        return;
      }

      const storedUser = window.localStorage.getItem("smartshala.user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser) as SessionUser;
          if (cancelled) return;
          setUser(parsed);
          setReady(true);
          prefetchForRole(parsed.role, parsed.tenantSchoolId);
        } catch {
          window.localStorage.removeItem("smartshala.user");
        }
      }

      try {
        const result = await authApi.me();
        if (cancelled) return;
        setUser(result.user);
        window.localStorage.setItem("smartshala.user", JSON.stringify(result.user));
        prefetchForRole(result.user.role, result.user.tenantSchoolId);
        setReady(true);
      } catch {
        clearCache();
        window.localStorage.removeItem("smartshala.accessToken");
        window.localStorage.removeItem("smartshala.refreshToken");
        window.localStorage.removeItem("smartshala.user");
        router.replace(withSchoolPath("/login", pathname));
      }
    }

    hydrateSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!ready || !user) return;
    const normalizedPathname = withoutSchoolPath(pathname);
    const pathSchoolId = schoolIdFromPath(pathname);

    if (!pathSchoolId && user.tenantSchoolId) {
      router.replace(withResolvedSchoolPath(normalizedPathname, user.tenantSchoolId));
      return;
    }

    if (isPathAllowedForRole(normalizedPathname, user.role)) return;
    router.replace(withResolvedSchoolPath(roleHome(user.role), user.tenantSchoolId ?? pathSchoolId));
  }, [pathname, ready, router, user]);

  if (!ready || !user) {
    return <WorkspaceSkeleton />;
  }

  if (!isPathAllowedForRole(withoutSchoolPath(pathname), user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="glass-card w-full max-w-sm p-8 text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#86868b]">Access control</p>
          <p className="mt-3 text-[18px] font-semibold text-[#1d1d1f]">Redirecting to your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--apple-bg)]">
      <PlatformTranslator />
      <div className="relative flex min-h-screen">
        <Sidebar
          onClose={() => setSidebarOpen(false)}
          open={sidebarOpen}
          role={user.role}
          isPinned={sidebarPinned}
          setIsPinned={setSidebarPinned}
        />
        <div className="flex min-w-0 flex-1 flex-col pl-0 md:pl-[60px] transition-all duration-300">
          <Topbar onMenuClick={handleToggleSidebar} user={user} />
          <main className="flex-1 px-4 pb-8 pt-3 sm:px-5 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

