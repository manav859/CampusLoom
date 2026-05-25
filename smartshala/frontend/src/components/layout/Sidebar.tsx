"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import type { Role } from "@/types";
import { schoolIdFromPath, withSchoolPath } from "@/lib/tenant";

type NavIconName = "dashboard" | "students" | "teachers" | "classes" | "attendance" | "reports" | "fees" | "analytics" | "notifications" | "activity" | "settings";

type NavLink = {
  label: string;
  href: string;
  icon: NavIconName;
};

type NavItem = NavLink | {
  children: NavLink[];
  icon: NavIconName;
  label: string;
};

const adminLinks: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Student", href: "/students", icon: "students" },
  {
    label: "Teacher",
    icon: "teachers",
    children: [
      { label: "Teacher", href: "/teachers", icon: "teachers" },
      { label: "Classes", href: "/classes", icon: "classes" },
      { label: "Attendance", href: "/attendance", icon: "attendance" },
      { label: "Homework", href: "/teacher/homework", icon: "reports" }
    ]
  },
  { label: "Communication", href: "/teacher/communication", icon: "notifications" },
  { label: "Reports", href: "/reports", icon: "reports" },
  { label: "Fees", href: "/fees", icon: "fees" },
  { label: "Analytics", href: "/analytics", icon: "analytics" },
  {
    label: "Logs",
    icon: "activity",
    children: [
      { label: "Message logs", href: "/notifications", icon: "notifications" },
      { label: "Activity Logs", href: "/activity-logs", icon: "activity" }
    ]
  },
  { label: "Setting", href: "/settings", icon: "settings" }
];

const teacherLinks: NavItem[] = [
  { label: "Dashboard", href: "/teacher", icon: "dashboard" },
  { label: "Classes", href: "/teacher/classes", icon: "classes" },
  { label: "Homework", href: "/teacher/homework", icon: "reports" },
  { label: "Marks", href: "/teacher/marks", icon: "analytics" },
  { label: "Comms hub", href: "/teacher/communication", icon: "notifications" },
  { label: "Mark Attendance", href: "/attendance", icon: "attendance" },
  { label: "Students", href: "/students", icon: "students" }
];

const accountantLinks: NavItem[] = [
  { label: "Fees", href: "/fees", icon: "fees" },
  { label: "Student", href: "/students", icon: "students" }
];

const parentLinks: NavItem[] = [
  { label: "Student", href: "/students", icon: "students" }
];

function isAdminRole(role: Role) {
  return role === "PRINCIPAL" || role === "ADMIN";
}

function linksForRole(role: Role) {
  if (isAdminRole(role)) return adminLinks;
  if (role === "ACCOUNTANT") return accountantLinks;
  if (role === "PARENT") return parentLinks;
  return teacherLinks;
}

function isActiveLink(pathname: string, href: string) {
  const schoolId = schoolIdFromPath(pathname);
  const normalized = schoolId ? pathname.replace(`/${schoolId}`, "") || "/" : pathname;
  if (href === "/teacher" || href === "/dashboard") return normalized === href;
  if (href === "/reports") return normalized === href || normalized.startsWith("/reports/");
  return normalized === href || normalized.startsWith(`${href}/`);
}

function hasChildren(item: NavItem): item is Extract<NavItem, { children: NavLink[] }> {
  return "children" in item;
}

function NavIcon({ icon, active }: { icon: NavIconName; active: boolean }) {
  const color = active ? "#ffffff" : "#86868b";

  if (icon === "dashboard") {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
        <path d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }

  if (icon === "students" || icon === "teachers") {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="3" stroke={color} strokeWidth="1.5" />
        <path d="M3 19a6 6 0 0112 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="17" cy="9" r="2.5" stroke={color} strokeWidth="1.5" />
        <path d="M15 19a4.5 4.5 0 016 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "classes") {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
        <path d="M4 7.5L12 4l8 3.5L12 11 4 7.5z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M6 9.5v7L12 20l6-3.5v-7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (icon === "attendance") {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
        <rect x="4" y="3" width="16" height="18" rx="2" stroke={color} strokeWidth="1.5" />
        <path d="M9 11l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 7h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "reports" || icon === "analytics") {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
        <path d="M6 20V10M12 20V4M18 20v-8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "fees") {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
        <rect x="2" y="6" width="20" height="12" rx="2" stroke={color} strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.5" />
        <path d="M6 6V4M18 6V4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "notifications") {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
        <path d="M12 5a4.5 4.5 0 00-4.5 4.5v3L5 16h14l-2.5-3.5v-3A4.5 4.5 0 0012 5z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 19a2 2 0 004 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "activity") {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
        <path d="M5 6h14M5 12h9M5 18h14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M17 10l2 2-2 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // settings
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.5" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Sidebar({
  role,
  open = false,
  onClose,
  isPinned,
  setIsPinned
}: {
  role: Role;
  open?: boolean;
  onClose?: () => void;
  isPinned: boolean;
  setIsPinned: (pinned: boolean) => void;
}) {
  const pathname = usePathname();
  const links = linksForRole(role);

  const [isHovered, setIsHovered] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isPinned) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        asideRef.current &&
        !asideRef.current.contains(target) &&
        !target.closest(".sidebar-toggle-btn")
      ) {
        setIsPinned(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isPinned, setIsPinned]);

  const isOpenDesktop = isHovered || isPinned;
  const isExpanded = open || isOpenDesktop;

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      for (const item of links) {
        if (hasChildren(item) && item.children.some((child) => isActiveLink(pathname, child.href))) {
          next[item.label] = true;
        }
      }
      return next;
    });
  }, [links, pathname]);

  const labelClass = `transition-all duration-300 ease-in-out whitespace-nowrap truncate md:transition-all ${
    isExpanded ? "opacity-100 max-w-[150px] ml-2.5" : "opacity-100 max-w-[150px] ml-2.5 md:opacity-0 md:max-w-0 md:ml-0 md:overflow-hidden"
  }`;

  return (
    <>
      {/* Mobile overlay */}
      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-[150] bg-black/20 backdrop-blur-sm transition-opacity duration-300 md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />

      {/* Sidebar panel — 200px per wireframe */}
      <aside
        ref={asideRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed inset-y-0 left-0 z-[160] flex flex-col bg-white border-r border-[var(--apple-card-border)] transition-all duration-300 ease-in-out md:fixed md:inset-y-0 md:left-0 md:z-40 md:h-screen md:pt-16 ${
          open ? "w-[200px] translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${
          isOpenDesktop ? "md:w-[200px]" : "md:w-[60px]"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-3.5 pt-5 pb-3 md:hidden">
          <div className="flex items-center">
            <div
              onClick={() => setIsPinned(!isPinned)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0071e3] shadow-lg shadow-blue-500/30 cursor-pointer"
            >
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <path d="M4 7.5L12 4l8 3.5L12 11 4 7.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M6 9.5v7L12 20l6-3.5v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className={`text-[15px] font-bold text-[#1d1d1f] tracking-tight ${labelClass}`}>SmartShala</p>
          </div>
          <button className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 transition-colors md:hidden" onClick={onClose} type="button">
            <svg className="h-4 w-4 text-[#86868b]" fill="none" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className={`mt-3 flex-1 space-y-0.5 px-2.5 pb-3 ${
          isExpanded ? "overflow-y-auto" : "overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }`}>
          {links.map((item) => {
            if (hasChildren(item)) {
              const active = item.children.some((child) => isActiveLink(pathname, child.href));
              const groupOpen = isExpanded && (openGroups[item.label] ?? active);

              return (
                <div key={item.label}>
                  <button
                    className={`group flex min-h-[42px] w-full items-center rounded-lg border py-2 text-[13px] font-semibold transition-all duration-300 ease-apple ${
                      isExpanded ? "justify-start px-3" : "justify-center px-0"
                    } ${
                      active
                        ? "border-[#0071e3] bg-[#0071e3] text-white shadow-md shadow-blue-500/20"
                        : "border-transparent text-[#424245] hover:border-[#0071e3] hover:text-[#1d1d1f]"
                    }`}
                    onClick={() => setOpenGroups((current) => ({ ...current, [item.label]: !(current[item.label] ?? active) }))}
                    type="button"
                  >
                    <NavIcon active={active} icon={item.icon} />
                    <span className={labelClass}>{item.label}</span>
                    <svg className={`ml-auto h-3.5 w-3.5 transition-transform duration-300 ${isExpanded ? "block" : "hidden"} ${groupOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 16 16">
                      <path d="m4 6 4 4 4-4" stroke={active ? "#ffffff" : "#86868b"} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    </svg>
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${groupOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      <div className="ml-5 mt-1 space-y-1 rounded-[10px] border border-[#E2E7EE] bg-[#F7F8FB] p-1.5">
                        {item.children.map((child) => {
                          const childActive = isActiveLink(pathname, child.href);
                          return (
                            <Link
                              className={`flex min-h-9 items-center gap-2 rounded-[7px] px-3 text-[12px] font-semibold transition-colors ${
                                childActive ? "bg-white text-[#2456E6] shadow-[0_1px_2px_rgba(15,20,25,0.06)]" : "text-[#5A6573] hover:bg-white hover:text-[#1d1d1f]"
                              }`}
                              href={withSchoolPath(child.href, pathname)}
                              key={child.href}
                              onClick={onClose}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${childActive ? "bg-[#2456E6]" : "bg-[#A0A7B2]"}`} />
                              <span className="truncate">{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const active = isActiveLink(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={withSchoolPath(item.href, pathname)}
                onClick={onClose}
                className={`group flex min-h-[42px] items-center rounded-lg border py-2 text-[13px] font-semibold transition-all duration-300 ease-apple ${
                  isExpanded ? "justify-start px-3" : "justify-center px-0"
                } ${
                  active
                    ? "border-[#0071e3] bg-[#0071e3] text-white shadow-md shadow-blue-500/20"
                    : "border-transparent text-[#424245] hover:border-[#0071e3] hover:text-[#1d1d1f]"
                }`}
              >
                <NavIcon active={active} icon={item.icon} />
                <span className={labelClass}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User avatar section at bottom */}
        <div className="border-t border-[#f5f5f7] px-3.5 py-4">
          <div className="flex items-center">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0071e3] to-[#5ac8fa] text-[10px] font-bold text-white shadow-lg shadow-blue-500/20">
              AD
            </div>
            <div className={`min-w-0 transition-all duration-300 ease-in-out ${
              isExpanded ? "opacity-100 max-w-[120px] ml-2.5" : "opacity-100 max-w-[120px] ml-2.5 md:opacity-0 md:max-w-0 md:ml-0 md:overflow-hidden"
            }`}>
              <p className="truncate text-[12px] font-semibold text-[#1d1d1f]">Admin</p>
              <p className="truncate text-[10px] text-[#86868b]">Principal</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
