"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/types";

export function Topbar({ user, onMenuClick }: { user: SessionUser; onMenuClick?: () => void }) {
  const router = useRouter();
  const [searchFocused, setSearchFocused] = useState(false);

  function logout() {
    window.localStorage.removeItem("smartshala.accessToken");
    window.localStorage.removeItem("smartshala.refreshToken");
    window.localStorage.removeItem("smartshala.user");
    router.replace("/login");
  }

  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-[52px] items-center bg-white/95 backdrop-blur-xl border-b border-[var(--apple-card-border)]">
      <div className="flex w-full items-center justify-between gap-3 px-5">
        {/* Left: hamburger (mobile) + school name */}
        <div className="flex min-w-0 items-center gap-3">
          <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#f5f5f7] transition-colors md:hidden" onClick={onMenuClick} type="button">
            <svg className="h-[18px] w-[18px] text-[#1d1d1f]" fill="none" viewBox="0 0 24 24">
              <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
          <p className="truncate text-[14px] font-semibold text-[#1d1d1f] tracking-tight">{user.schoolName}</p>
        </div>

        {/* Center: search bar */}
        <div className="hidden sm:flex flex-1 max-w-[320px] mx-auto">
          <div className={`relative w-full transition-all duration-300 ${searchFocused ? "scale-[1.02]" : ""}`}>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" fill="none" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search…"
              className="w-full h-[32px] rounded-lg bg-[#f5f5f7] pl-9 pr-3 text-[13px] text-[#1d1d1f] placeholder-[#86868b] outline-none border border-transparent transition-all duration-200 focus:bg-white focus:border-[#0071e3]/30 focus:shadow-[0_0_0_3px_rgba(0,113,227,0.08)]"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>
        </div>

        {/* Right: notifications + avatar + sign out */}
        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <button className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#f5f5f7] transition-colors" type="button">
            <svg className="h-[18px] w-[18px] text-[#424245]" fill="none" viewBox="0 0 24 24">
              <path d="M12 5a4.5 4.5 0 00-4.5 4.5v3L5 16h14l-2.5-3.5v-3A4.5 4.5 0 0012 5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {/* Notification dot */}
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#ff3b30] ring-2 ring-white" />
          </button>

          {/* Avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#0071e3] to-[#5ac8fa] text-[10px] font-bold text-white shadow-md shadow-blue-500/15">
            {initials}
          </div>

          <button className="hidden sm:block text-[13px] font-semibold text-[#0071e3] hover:text-[#0077ed] transition-colors" onClick={logout} type="button">
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
