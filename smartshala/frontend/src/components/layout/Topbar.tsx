"use client";

import { useRouter } from "next/navigation";
import type { SessionUser } from "@/types";

export function Topbar({ user, onMenuClick }: { user: SessionUser; onMenuClick?: () => void }) {
  const router = useRouter();

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
    <header className="sticky top-0 z-20 bg-white border-b border-[var(--apple-card-border)]">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f5f5f7] transition-colors md:hidden" onClick={onMenuClick} type="button">
            <svg className="h-[20px] w-[20px] text-[#1d1d1f]" fill="none" viewBox="0 0 24 24">
              <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-[#86868b]">{user.schoolName}</p>
            <p className="truncate text-[18px] font-bold text-[#1d1d1f] tracking-tight mt-0.5">{user.fullName}</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#0071e3] to-[#5ac8fa] text-[11px] font-bold text-white shadow-lg shadow-blue-500/20">
            {initials}
          </div>
          <button className="text-[14px] font-bold text-[#0071e3] hover:text-[#0077ed] transition-colors" onClick={logout} type="button">
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
