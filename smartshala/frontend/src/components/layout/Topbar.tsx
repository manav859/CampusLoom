"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import type { SessionUser } from "@/types";
import { clearCache, invalidateCache } from "@/lib/prefetchCache";
import { settingsApi, whatsappApi, type NotificationLog } from "@/lib/api";
import { AcademicYearSwitcher } from "./AcademicYearSwitcher";
import { LanguageToggle } from "./PlatformLanguage";
import { NotificationPanel, isPrincipalNotification } from "./NotificationPanel";

/* ── Live Clock ── */
function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayName = days[now.getDay()];
  const date = now.getDate();
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;

  return (
    <div className="hidden lg:flex flex-col items-end leading-tight">
      <span className="text-[13px] font-semibold text-[#1d1d1f] tracking-tight">
        {dayName} · {date} {month} {year}
      </span>
      <span className="text-[11px] font-medium text-[#86868b]">
        {h12}:{minutes} {ampm}
      </span>
    </div>
  );
}

/* ── Academic Year ── */
function getAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  if (month >= 3) return `${year}–${(year + 1).toString().slice(-2)}`;
  return `${year - 1}–${year.toString().slice(-2)}`;
}

/* ── Topbar ── */
export function Topbar({ user, onMenuClick }: { user: SessionUser; onMenuClick?: () => void }) {
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLogs, setNotifLogs] = useState<NotificationLog[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Close user menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const logout = useCallback(() => {
    clearCache();
    window.localStorage.removeItem("smartshala.accessToken");
    window.localStorage.removeItem("smartshala.refreshToken");
    window.localStorage.removeItem("smartshala.user");
    router.replace("/login");
  }, [router]);

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      setNotifLogs(await whatsappApi.logs());
    } catch {
      setNotifLogs([]);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const clearNotifications = useCallback(async () => {
    await whatsappApi.clear();
    invalidateCache("notifications:logs");
    setNotifLogs([]);
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    await whatsappApi.delete(id);
    invalidateCache("notifications:logs");
    setNotifLogs((current) => current.filter((log) => log.id !== id));
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    let active = true;
    settingsApi.schoolProfile()
      .then((profile) => {
        if (active) setSchoolLogo(profile.logoUrl ?? null);
      })
      .catch(() => {
        if (active) setSchoolLogo(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleLogoChange(event: Event) {
      const detail = (event as CustomEvent<{ logoUrl?: string | null }>).detail;
      setSchoolLogo(detail?.logoUrl ?? null);
    }

    window.addEventListener("smartshala:school-logo", handleLogoChange);
    return () => window.removeEventListener("smartshala:school-logo", handleLogoChange);
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const notifCount = notifLogs.filter((log) => isPrincipalNotification(log) && new Date(log.createdAt).getTime() >= today.getTime()).length;

  return (
    <>
      <header className="sticky top-0 z-[100] flex h-16 items-center bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
        <div className="flex w-full items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5">

          {/* ── Left: Hamburger + School Identity ── */}
          <div className="flex min-w-0 flex-1 items-center">
            {/* Left: Brand Group (Hamburger + Logo + SmartShala) */}
            <div className="flex w-auto md:w-[220px] shrink-0 items-center gap-3">
              <button
                className="sidebar-toggle-btn flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#f5f5f7] transition-colors"
                onClick={onMenuClick}
                type="button"
              >
                <svg className="sidebar-toggle-btn h-[18px] w-[18px] text-[#1d1d1f]" fill="none" viewBox="0 0 24 24">
                  <path className="sidebar-toggle-btn" d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
              
              {/* PC View Brand Logo */}
              <div className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0071e3] shadow-lg shadow-blue-500/30">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <path d="M4 7.5L12 4l8 3.5L12 11 4 7.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M6 9.5v7L12 20l6-3.5v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Brand Name */}
              <span className="hidden text-[15px] font-bold text-[#1d1d1f] tracking-tight md:inline">SmartShala</span>
            </div>

            {/* School Identity Group */}
            <div className="ml-1 flex min-w-0 flex-1 items-center gap-2 md:ml-4 md:gap-2.5">
              {/* School Logo */}
              {schoolLogo ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-white">
                  <img alt="School logo" className="h-full w-full object-contain" src={schoolLogo} />
                </span>
              ) : (
                <span className="text-[20px] shrink-0" role="img" aria-label="School">🏫</span>
              )}

              <div className="min-w-0 flex-1">
                <div className="mobile-school-marquee md:hidden">
                  <span className="mobile-school-marquee-track">
                    <span>
                      {user.schoolName || "SmartShala Partner School"}
                      <span className="text-[#86868b] font-normal"> - </span>
                      <span className="text-[#86868b] font-normal text-[13px]">Ahmedabad</span>
                    </span>
                    <span aria-hidden="true">
                      {user.schoolName || "SmartShala Partner School"}
                      <span className="text-[#86868b] font-normal"> - </span>
                      <span className="text-[#86868b] font-normal text-[13px]">Ahmedabad</span>
                    </span>
                  </span>
                </div>
                <p className="hidden truncate text-[15px] font-semibold text-[#1d1d1f] tracking-tight leading-tight md:block">
                  {user.schoolName || "SmartShala Partner School"}
                  <span className="text-[#86868b] font-normal"> · </span>
                  <span className="text-[#86868b] font-normal text-[13px]">Ahmedabad</span>
                </p>
              </div>
            </div>
          </div>

          {/* ── Right: Notifications + Clock + Avatar ── */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            {/* Notification Bell */}
            <button
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-colors"
              type="button"
              onClick={() => {
                setNotifOpen(true);
                loadNotifications();
              }}
            >
              <svg className="h-[18px] w-[18px] text-[#424245]" fill="none" viewBox="0 0 24 24">
                <path d="M12 5a4.5 4.5 0 00-4.5 4.5v3L5 16h14l-2.5-3.5v-3A4.5 4.5 0 0012 5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {notifCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {notifCount}
                </span>
              )}
            </button>

            <AcademicYearSwitcher />
            <LanguageToggle />

            {/* Divider */}
            <div className="hidden lg:block h-7 w-px bg-[#d2d2d7]/60" />

            {/* Clock & Date */}
            <LiveClock />

            {/* Divider */}
            <div className="hidden lg:block h-7 w-px bg-[#d2d2d7]/60" />

            {/* User Avatar + Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#1a3c4d] to-[#2a7a94] text-[11px] font-bold text-white shadow-md shadow-teal-900/15 hover:shadow-lg hover:shadow-teal-900/20 transition-all duration-200 cursor-pointer"
                type="button"
              >
                {initials}
              </button>

              {/* Dropdown Menu */}
              {menuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-[110] w-56 rounded-2xl bg-white/95 backdrop-blur-xl border border-[rgba(0,0,0,0.06)] shadow-[0_8px_32px_rgba(0,0,0,0.12)] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
                    <p className="text-[14px] font-semibold text-[#1d1d1f] truncate">{user.fullName}</p>
                    <p className="text-[12px] text-[#86868b] truncate capitalize">{user.role.toLowerCase()}</p>
                  </div>
                  <div className="py-1">
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors text-left">
                      <svg className="h-4 w-4 text-[#86868b]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      Profile
                    </button>
                  </div>
                  <div className="border-t border-[rgba(0,0,0,0.06)] py-1">
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-[#ff3b30] hover:bg-[#ff3b30]/5 transition-colors text-left"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Notification Slide-out Panel */}
      <NotificationPanel
        open={notifOpen}
        onClear={clearNotifications}
        onClose={() => setNotifOpen(false)}
        onDelete={deleteNotification}
        logs={notifLogs}
        loading={notifLoading}
      />
    </>
  );
}
