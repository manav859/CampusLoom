"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import type { SessionUser } from "@/types";
import { clearCache } from "@/lib/prefetchCache";
import { whatsappApi, type NotificationLog } from "@/lib/api";
import { AcademicYearSwitcher } from "./AcademicYearSwitcher";
import { LanguageToggle } from "./PlatformLanguage";
import { NotificationPanel } from "./NotificationPanel";

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

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const notifCount = notifLogs.filter((log) => new Date(log.createdAt).getTime() >= today.getTime()).length;

  return (
    <>
      <header className="sticky top-0 z-[100] flex h-16 items-center bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
        <div className="flex w-full items-center justify-between gap-4 px-5">

          {/* ── Left: Hamburger (mobile) + School Identity ── */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#f5f5f7] transition-colors md:hidden"
              onClick={onMenuClick}
              type="button"
            >
              <svg className="h-[18px] w-[18px] text-[#1d1d1f]" fill="none" viewBox="0 0 24 24">
                <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[20px]" role="img" aria-label="School">🏫</span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[#1d1d1f] tracking-tight leading-tight">
                  SmartShala
                  {user.schoolName ? (
                    <>
                      {" "}
                      <span className="text-[#86868b] font-normal">·</span>{" "}
                      <span className="text-[#424245]">{user.schoolName}</span>
                    </>
                  ) : null}
                  {" "}
                  <span className="text-[#86868b] font-normal">·</span>{" "}
                  <span className="text-[#86868b] font-normal text-[13px]">Ahmedabad</span>
                </p>
                <p className="text-[11px] font-medium text-[#86868b] leading-tight">
                  {getAcademicYear()}
                </p>
              </div>
            </div>
          </div>

          {/* ── Right: Notifications + Clock + Avatar ── */}
          <div className="flex items-center gap-2.5">
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
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors text-left">
                      <svg className="h-4 w-4 text-[#86868b]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                      </svg>
                      Switch Role
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
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} logs={notifLogs} loading={notifLoading} />
    </>
  );
}
