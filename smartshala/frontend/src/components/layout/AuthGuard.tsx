"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Role, SessionUser } from "@/types";
import { authApi, refreshAccessToken } from "@/lib/api";
import { tokenStore } from "@/lib/tokenStore";
import { clearCache, prefetchForRole } from "@/lib/prefetchCache";
import { schoolIdFromPath, withResolvedSchoolPath, withSchoolPath } from "@/lib/tenant";
import { PlatformTranslator } from "./PlatformLanguage";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { TutorialModal } from "@/components/tutorial/TutorialModal";
import { Skeleton, KpiCardSkeleton, ChartSkeleton, AlertSkeleton } from "@/components/ui/Skeleton";

function tutorialSeenKey(userId: string) {
  return `smartshala.tutorialSeen.${userId}`;
}

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
  if (matchesPrefix(pathname, "/profile")) return true;
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

// Loading state for the authenticated shell. Mirrors the real Topbar + collapsed
// sidebar rail + dashboard layout so the screen reads as "loading" (shimmer) and
// the content slots in without a layout jump once the session hydrates.
function WorkspaceSkeleton() {
  return (
    <div className="relative min-h-screen bg-[var(--apple-bg)]">
      {/* Top bar — matches Topbar: sticky h-16, white, soft shadow */}
      <header className="sticky top-0 z-[100] flex h-16 items-center bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
        <div className="flex w-full items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5">
          {/* Left: real brand mark (instant) + skeleton school identity */}
          <div className="flex min-w-0 flex-1 items-center">
            <div className="flex w-auto items-center gap-3 md:w-[220px]">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0071e3] shadow-lg shadow-blue-500/30 md:flex">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <path d="M4 7.5L12 4l8 3.5L12 11 4 7.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M6 9.5v7L12 20l6-3.5v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="hidden text-[15px] font-bold tracking-tight text-[#1d1d1f] md:inline">SmartShala</span>
            </div>
            <div className="ml-1 flex min-w-0 flex-1 items-center gap-2 md:ml-4 md:gap-2.5">
              <Skeleton className="h-7 w-7 shrink-0 rounded-[6px]" />
              <Skeleton className="h-4 w-36 rounded-md sm:w-48" />
            </div>
          </div>

          {/* Center: search bar */}
          <Skeleton className="hidden h-10 min-w-[280px] max-w-[540px] flex-1 rounded-[10px] md:block" />

          {/* Right: controls + avatar */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="hidden h-8 w-16 rounded-full sm:block" />
            <div className="hidden h-7 w-px bg-[#d2d2d7]/60 lg:block" />
            <Skeleton className="hidden h-8 w-28 rounded-md lg:block" />
            <div className="hidden h-7 w-px bg-[#d2d2d7]/60 lg:block" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </header>

      <div className="relative flex min-h-[calc(100vh-4rem)]">
        {/* Collapsed sidebar rail — matches Sidebar md:w-[70px] */}
        <div className="hidden w-[70px] shrink-0 border-r border-[var(--apple-card-border)] bg-white md:block">
          <div className="space-y-2 px-2.5 pt-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-11 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Main content — KPI cards + chart + alerts, matches dashboard padding */}
        <main className="min-w-0 flex-1 px-4 pb-8 pt-3 sm:px-5 lg:px-6">
          <div className="mt-1 space-y-2">
            <Skeleton className="h-7 w-56 rounded-md" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <KpiCardSkeleton key={i} />
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ChartSkeleton height={320} />
            </div>
            <AlertSkeleton rows={5} />
          </div>
        </main>
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
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const closeTutorial = () => {
    setTutorialOpen(false);
    if (user) {
      try {
        window.localStorage.setItem(tutorialSeenKey(user.id), "1");
      } catch {
        // ignore storage failures (private mode etc.)
      }
    }
  };

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
      // Access token lives in memory only. On a page refresh it is gone, so try to
      // restore the session from the httpOnly refresh cookie before giving up.
      let token = tokenStore.get();
      if (!token) {
        token = await refreshAccessToken();
        if (token) tokenStore.set(token);
      }
      if (cancelled) return;
      if (!token) {
        // Refresh failed (no session, or the school was deactivated/deleted).
        // Drop any stale user so tenant API calls stop resolving to a dead
        // school, then send the user to login.
        clearCache();
        tokenStore.clear();
        window.localStorage.removeItem("smartshala.user");
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
        tokenStore.clear();
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

  // Show the feature tour automatically on a principal's/teacher's first login.
  useEffect(() => {
    if (!ready || !user) return;
    const eligible = user.role === "PRINCIPAL" || user.role === "ADMIN" || user.role === "TEACHER";
    if (!eligible) return;
    try {
      if (!window.localStorage.getItem(tutorialSeenKey(user.id))) {
        setTutorialOpen(true);
      }
    } catch {
      // ignore storage failures
    }
  }, [ready, user]);

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
      <Topbar onMenuClick={handleToggleSidebar} user={user} />
      <div className="relative flex min-h-[calc(100vh-4rem)]">
        <Sidebar
          onClose={() => setSidebarOpen(false)}
          open={sidebarOpen}
          role={user.role}
          fullName={user.fullName}
          isPinned={sidebarPinned}
          setIsPinned={setSidebarPinned}
          onOpenTutorial={() => setTutorialOpen(true)}
        />
        <div className="flex min-w-0 flex-1 flex-col pl-0 md:pl-[70px] transition-all duration-300">
          <main className="flex-1 px-4 pb-8 pt-3 sm:px-5 lg:px-6">{children}</main>
        </div>
      </div>
      <TutorialModal isOpen={tutorialOpen} onClose={closeTutorial} />
    </div>
  );
}

