"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types";

type NavLink = {
  label: string;
  href: string;
  icon: "dashboard" | "students" | "teachers" | "classes" | "attendance" | "reports" | "fees" | "analytics" | "notifications" | "settings";
};

const adminLinks: NavLink[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Students", href: "/students", icon: "students" },
  { label: "Teachers", href: "/teachers", icon: "teachers" },
  { label: "Classes", href: "/classes", icon: "classes" },
  { label: "Attendance", href: "/attendance", icon: "attendance" },
  { label: "Reports", href: "/reports", icon: "reports" },
  { label: "Fees", href: "/fees", icon: "fees" },
  { label: "Defaulters", href: "/fees/defaulters", icon: "fees" },
  { label: "Analytics", href: "/analytics", icon: "analytics" },
  { label: "WhatsApp Logs", href: "/notifications", icon: "notifications" },
  { label: "Settings", href: "/settings", icon: "settings" }
];

const teacherLinks: NavLink[] = [
  { label: "Dashboard", href: "/teacher", icon: "dashboard" },
  { label: "Mark Attendance", href: "/attendance", icon: "attendance" },
  { label: "Attendance Reports", href: "/attendance/reports", icon: "reports" },
  { label: "Students", href: "/students", icon: "students" },
  { label: "Analytics", href: "/analytics", icon: "analytics" }
];

function isAdminRole(role: Role) {
  return role === "PRINCIPAL" || role === "ADMIN";
}

function NavIcon({ icon, active }: { icon: NavLink["icon"]; active: boolean }) {
  const color = active ? "#0071e3" : "#86868b";

  if (icon === "dashboard") {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
        <path d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }

  if (icon === "students" || icon === "teachers") {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="3" stroke={color} strokeWidth="1.5" />
        <path d="M3 19a6 6 0 0112 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="17" cy="9" r="2.5" stroke={color} strokeWidth="1.5" />
        <path d="M15 19a4.5 4.5 0 016 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "classes") {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
        <path d="M4 7.5L12 4l8 3.5L12 11 4 7.5z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M6 9.5v7L12 20l6-3.5v-7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (icon === "attendance") {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
        <rect x="4" y="3" width="16" height="18" rx="2" stroke={color} strokeWidth="1.5" />
        <path d="M9 11l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 7h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "reports" || icon === "analytics") {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
        <path d="M6 20V10M12 20V4M18 20v-8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "fees") {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
        <rect x="2" y="6" width="20" height="12" rx="2" stroke={color} strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.5" />
        <path d="M6 6V4M18 6V4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "notifications") {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
        <path d="M12 5a4.5 4.5 0 00-4.5 4.5v3L5 16h14l-2.5-3.5v-3A4.5 4.5 0 0012 5z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 19a2 2 0 004 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  // settings
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.5" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Sidebar({ role, open = false, onClose }: { role: Role; open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const links = isAdminRole(role) ? adminLinks : teacherLinks;

  return (
    <>
      {/* Mobile overlay */}
      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-30 bg-black/20 backdrop-blur-sm transition-opacity duration-300 md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col bg-white border-r border-[var(--apple-card-border)] transition-transform duration-300 ease-apple md:sticky md:top-0 md:z-10 md:h-screen ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 pt-8 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0071e3] shadow-lg shadow-blue-500/30">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <path d="M4 7.5L12 4l8 3.5L12 11 4 7.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M6 9.5v7L12 20l6-3.5v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1d1d1f] tracking-tight">SmartShala</p>
              </div>
            </div>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5 transition-colors md:hidden" onClick={onClose} type="button">
            <svg className="h-5 w-5 text-[#86868b]" fill="none" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {links.map(({ label, href, icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`) || (href === "/reports" && pathname.startsWith("/attendance/reports"));

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-bold transition-all duration-300 ease-apple ${
                  active
                    ? "bg-[#0071e3] text-white shadow-md shadow-blue-500/20"
                    : "text-[#424245] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                }`}
              >
                <NavIcon active={active} icon={icon} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-[#f5f5f7] px-6 py-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#86868b]">ERP Systems</p>
          <p className="mt-2 text-[12px] leading-relaxed text-[#424245]">High-performance school management.</p>
        </div>
      </aside>
    </>
  );
}
