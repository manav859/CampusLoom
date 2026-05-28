"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import type { Role } from "@/types";
import { schoolIdFromPath, withSchoolPath } from "@/lib/tenant";

type NavIconName =
  | "dashboard"
  | "students"
  | "teachers"
  | "classManagement"
  | "classes"
  | "attendance"
  | "homework"
  | "communication"
  | "reports"
  | "fees"
  | "analytics"
  | "logs"
  | "settings";

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
    label: "Class Management",
    icon: "classManagement",
    children: [
      { label: "Teacher", href: "/teachers", icon: "teachers" },
      { label: "Classes", href: "/classes", icon: "classes" },
      { label: "Attendance", href: "/attendance", icon: "attendance" },
      { label: "Homework", href: "/teacher/homework", icon: "homework" }
    ]
  },
  { label: "Communication", href: "/teacher/communication", icon: "communication" },
  {
    label: "Reports",
    icon: "reports",
    children: [
      { label: "Daily attendance report", href: "/reports/daily-attendance", icon: "attendance" },
      { label: "Student performance report", href: "/reports/student-performance", icon: "students" },
      { label: "Subject wise report", href: "/reports/subject-wise", icon: "reports" },
      { label: "Teacher performance", href: "/reports/teacher-performance", icon: "teachers" }
    ]
  },
  { label: "Fees", href: "/fees", icon: "fees" },
  { label: "Analytics", href: "/analytics", icon: "analytics" },
  {
    label: "Logs",
    icon: "logs",
    children: [
      { label: "Message logs", href: "/notifications", icon: "communication" },
      { label: "Activity Logs", href: "/activity-logs", icon: "logs" }
    ]
  },
  { label: "Setting", href: "/settings", icon: "settings" }
];

const teacherLinks: NavItem[] = [
  { label: "Dashboard", href: "/teacher", icon: "dashboard" },
  { label: "Classes", href: "/teacher/classes", icon: "classes" },
  { label: "Homework", href: "/teacher/homework", icon: "homework" },
  { label: "Marks", href: "/teacher/marks", icon: "analytics" },
  { label: "Comms hub", href: "/teacher/communication", icon: "communication" },
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

function SidebarLabel({ expanded, label, withMargin = true }: { expanded: boolean; label: string; withMargin?: boolean }) {
  const marginClass = withMargin ? "ml-2.5" : "";

  return (
    <span
      className={`sidebar-label-shell transition-all duration-300 ease-in-out md:transition-all ${
        expanded ? `${marginClass} w-[220px] opacity-100` : `${marginClass} w-[220px] opacity-100 md:ml-0 md:w-0 md:opacity-0`
      }`}
      title={label}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

function NavIcon({ icon, active }: { icon: NavIconName; active: boolean }) {
  const color = active ? "#ffffff" : "#000000";

  if (icon === "dashboard") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <line x1="9" y1="17" x2="15" y2="17" />
      </svg>
    );
  }

  if (icon === "students") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  if (icon === "classManagement") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="3" />
        <path d="M3 18v-1a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1" />
        <path d="M16 9h5M21 9l-2-2M21 9l-2 2" />
        <path d="M20 15h-5M15 15l2-2M15 15l2 2" />
      </svg>
    );
  }

  if (icon === "teachers") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4" />
        <path d="M10 15H6a4 4 0 0 0-4 4v2" />
        <circle cx="19" cy="16" r="1.5" />
        <path d="M19 13.5v1M19 17.5v1M16.5 16h1M20.5 16h1M17.2 14.2l.7.7M19.8 16.8l.7.7M17.2 17.8l.7-.7M19.8 14.2l.7-.7" />
      </svg>
    );
  }

  if (icon === "classes") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
      </svg>
    );
  }

  if (icon === "attendance") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 21a6 6 0 0 0-2-8" />
        <path d="M11 13c-2.5-1.5-5-1-6.5.5" />
        <path d="M11 13c-1.5-2.5-3-4-5-4.5" />
        <path d="M11 13c1-2.5 3-4 5.5-4.5" />
        <path d="M11 13c2.5-1.5 5-1 6.5.5" />
        <path d="M11 13c.5 2.5 0 5-1.5 7" />
      </svg>
    );
  }

  if (icon === "homework") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    );
  }

  if (icon === "communication") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }

  if (icon === "reports") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </svg>
    );
  }

  if (icon === "fees") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M13.5 11h-2a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3h-2" />
        <path d="M12.5 9.5v8" />
      </svg>
    );
  }

  if (icon === "analytics") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 20V10M12 20V4M18 20v-8" />
      </svg>
    );
  }

  if (icon === "logs") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.5 2H8.62a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6.88a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
        <path d="M18.5 6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6.88a2 2 0 0 1-2-2" />
      </svg>
    );
  }

  if (icon === "activity") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <circle cx="17" cy="17" r="4" />
        <polyline points="17 15 17 17 18.5 18" />
      </svg>
    );
  }

  // settings
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
    if (!isExpanded) {
      setOpenGroups({});
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    setOpenGroups((current) => {
      const next = { ...current };
      for (const item of links) {
        if (hasChildren(item) && next[item.label] === undefined && item.children.some((child) => isActiveLink(pathname, child.href))) {
          next[item.label] = true;
        }
      }
      return next;
    });
  }, [isExpanded, links, pathname]);

  const brandLabelClass = `transition-all duration-300 ease-in-out whitespace-nowrap truncate md:transition-all ${
    isExpanded ? "opacity-100 max-w-[220px] ml-2.5" : "opacity-100 max-w-[220px] ml-2.5 md:opacity-0 md:max-w-0 md:ml-0 md:overflow-hidden"
  }`;

  return (
    <>
      {/* Mobile overlay */}
      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-[150] bg-black/20 backdrop-blur-sm transition-opacity duration-300 md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <aside
        ref={asideRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed inset-y-0 left-0 z-[160] flex flex-col bg-white border-r border-[var(--apple-card-border)] transition-all duration-300 ease-in-out md:fixed md:inset-y-0 md:left-0 md:z-40 md:h-screen md:pt-16 ${
          open ? "w-[300px] translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${
          isOpenDesktop ? "md:w-[300px]" : "md:w-[60px]"
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
            <p className={`text-[15px] font-bold text-[#1d1d1f] tracking-tight ${brandLabelClass}`}>SmartShala</p>
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
              const groupOpen = isExpanded && Boolean(openGroups[item.label]);

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
                    <SidebarLabel expanded={isExpanded} label={item.label} />
                    <svg className={`ml-auto h-3.5 w-3.5 transition-transform duration-300 ${isExpanded ? "block" : "hidden"} ${groupOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 16 16">
                      <path d="m4 6 4 4 4-4" stroke={active ? "#ffffff" : "#000000"} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    </svg>
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${groupOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      <div className="ml-7 mt-1 space-y-0 border-l-2 border-[#D2D8E0] py-1 pl-6">
                        {item.children.map((child) => {
                          const childActive = isActiveLink(pathname, child.href);
                          return (
                            <Link
                              className={`flex min-h-11 items-center rounded-[8px] px-3 text-[13px] font-semibold transition-colors ${
                                childActive ? "bg-[#0071e3] text-white shadow-sm shadow-blue-500/20" : "text-[#2F3136] hover:bg-[#E2F0FB] hover:text-[#0071e3]"
                              }`}
                              href={withSchoolPath(child.href, pathname)}
                              key={child.href}
                              onClick={onClose}
                            >
                              <SidebarLabel expanded label={child.label} withMargin={false} />
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
                <SidebarLabel expanded={isExpanded} label={item.label} />
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
              isExpanded ? "opacity-100 max-w-[220px] ml-2.5" : "opacity-100 max-w-[220px] ml-2.5 md:opacity-0 md:max-w-0 md:ml-0 md:overflow-hidden"
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
