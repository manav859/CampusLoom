"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { SessionUser } from "@/types";
import { clearCache, invalidateCache } from "@/lib/prefetchCache";
import { settingsApi, whatsappApi, type NotificationLog } from "@/lib/api";
import { withSchoolPath } from "@/lib/tenant";
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

type SearchIconName =
  | "analytics"
  | "attendance"
  | "classes"
  | "communication"
  | "dashboard"
  | "fees"
  | "homework"
  | "logs"
  | "reports"
  | "settings"
  | "students"
  | "teachers";

type SearchResult = {
  description: string;
  href: string;
  icon: SearchIconName;
  keywords: string;
  roles: SessionUser["role"][];
  title: string;
  type: "Module" | "Page" | "Function" | "Report";
};

const adminRoles: SessionUser["role"][] = ["PRINCIPAL", "ADMIN"];
const staffRoles: SessionUser["role"][] = ["PRINCIPAL", "ADMIN", "TEACHER"];
const allRoles: SessionUser["role"][] = ["PRINCIPAL", "ADMIN", "TEACHER", "ACCOUNTANT", "PARENT"];

const searchResults: SearchResult[] = [
  { title: "Dashboard", description: "KPIs, alerts, recent activity", href: "/dashboard", icon: "dashboard", type: "Module", roles: adminRoles, keywords: "home overview metrics kpi alerts activity" },
  { title: "Teacher dashboard", description: "Class workload and teacher shortcuts", href: "/teacher", icon: "dashboard", type: "Module", roles: ["TEACHER"], keywords: "home overview teacher" },
  { title: "Students", description: "Search, import, bulk actions, profiles", href: "/students", icon: "students", type: "Module", roles: allRoles, keywords: "student admission profile parent guardian csv import bulk promote inactive" },
  { title: "Add student", description: "Create a new student profile", href: "/students/new", icon: "students", type: "Function", roles: staffRoles, keywords: "new admission register create student" },
  { title: "Teachers", description: "Teacher directory and management", href: "/teachers", icon: "teachers", type: "Module", roles: adminRoles, keywords: "staff faculty teacher directory" },
  { title: "Add teacher", description: "Create a teacher account", href: "/teachers/new", icon: "teachers", type: "Function", roles: adminRoles, keywords: "new teacher staff faculty create" },
  { title: "Classes", description: "Class sections, rosters, class teachers", href: "/classes", icon: "classes", type: "Module", roles: staffRoles, keywords: "class section roster subjects class teacher" },
  { title: "Add class", description: "Create a class and section", href: "/classes/new", icon: "classes", type: "Function", roles: adminRoles, keywords: "new class section create" },
  { title: "Attendance", description: "Daily marking and monthly calendar", href: "/attendance", icon: "attendance", type: "Module", roles: staffRoles, keywords: "present absent late half day calendar mark attendance" },
  { title: "Mark attendance", description: "Open attendance marking workflow", href: "/attendance", icon: "attendance", type: "Function", roles: staffRoles, keywords: "take attendance present absent late half day" },
  { title: "Daily attendance report", description: "Class-wise attendance summary", href: "/reports/daily-attendance", icon: "reports", type: "Report", roles: adminRoles, keywords: "attendance report export csv pdf nudge teachers" },
  { title: "Homework", description: "Assignments, due dates, submissions", href: "/teacher/homework", icon: "homework", type: "Module", roles: staffRoles, keywords: "assignment homework due submission parent nudge" },
  { title: "Marks", description: "Exam marks and grading", href: "/teacher/marks", icon: "analytics", type: "Module", roles: ["TEACHER"], keywords: "marks exam grades score results" },
  { title: "Communication", description: "Messages and parent communication", href: "/teacher/communication", icon: "communication", type: "Module", roles: staffRoles, keywords: "whatsapp message parent communication sms" },
  { title: "Notifications", description: "WhatsApp delivery logs", href: "/notifications", icon: "communication", type: "Page", roles: adminRoles, keywords: "message logs whatsapp notification sent failed retry" },
  { title: "Activity logs", description: "Audit trail and user activity", href: "/activity-logs", icon: "logs", type: "Page", roles: adminRoles, keywords: "audit logs activity history changes" },
  { title: "Fees", description: "Fee dashboard, structures, payments", href: "/fees", icon: "fees", type: "Module", roles: ["PRINCIPAL", "ADMIN", "ACCOUNTANT"], keywords: "fees payment collection ledger receipt structure" },
  { title: "Create fee structure", description: "Add a new fee plan", href: "/fees/new", icon: "fees", type: "Function", roles: ["PRINCIPAL", "ADMIN", "ACCOUNTANT"], keywords: "new fee structure create plan" },
  { title: "Fee defaulters", description: "Pending balances and reminders", href: "/fees/defaulters", icon: "fees", type: "Page", roles: ["PRINCIPAL", "ADMIN", "ACCOUNTANT"], keywords: "defaulter due pending balance reminder" },
  { title: "Add accountant", description: "Create accountant access", href: "/fees/accountants/new", icon: "fees", type: "Function", roles: adminRoles, keywords: "accountant user finance access" },
  { title: "Analytics", description: "Risk insights and school trends", href: "/analytics", icon: "analytics", type: "Module", roles: adminRoles, keywords: "analytics insights risk attendance fees performance" },
  { title: "Reports", description: "All school performance reports", href: "/reports", icon: "reports", type: "Module", roles: adminRoles, keywords: "reports export csv pdf attendance student teacher subject" },
  { title: "Student performance report", description: "Student-wise academic overview", href: "/reports/student-performance", icon: "reports", type: "Report", roles: adminRoles, keywords: "student performance attendance report export csv pdf" },
  { title: "Subject wise report", description: "Subject performance by student", href: "/reports/subject-wise", icon: "reports", type: "Report", roles: adminRoles, keywords: "subject marks exam average best report export csv pdf" },
  { title: "Teacher performance", description: "Teacher workload and coverage", href: "/reports/teacher-performance", icon: "reports", type: "Report", roles: adminRoles, keywords: "teacher performance attendance coverage report export csv pdf" },
  { title: "Settings", description: "School profile, roles, templates", href: "/settings", icon: "settings", type: "Module", roles: adminRoles, keywords: "settings school profile academic year holiday grading fee category user role whatsapp template branding backup" }
];

function SearchGlyph({ icon }: { icon: SearchIconName }) {
  if (icon === "dashboard") return <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10z" />;
  if (icon === "students") return <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.8" /></>;
  if (icon === "teachers") return <><circle cx="9" cy="7" r="4" /><path d="M4 21v-2a4 4 0 0 1 4-4h2" /><path d="M17 11v6M14 14h6" /></>;
  if (icon === "classes") return <><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" /></>;
  if (icon === "attendance") return <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M8 15l2 2 5-5" /></>;
  if (icon === "homework") return <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v5h5M9 15l2 2 4-4" /></>;
  if (icon === "communication") return <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />;
  if (icon === "fees") return <><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>;
  if (icon === "analytics") return <path d="M5 20V10M12 20V4M19 20v-7" />;
  if (icon === "logs") return <><path d="M8 6h10M8 12h10M8 18h10" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>;
  if (icon === "settings") return <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H2v-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V2h4v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1h.2v4h-.2a1.7 1.7 0 0 0-1.5 1z" /></>;
  return <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v5h5M9 13h6M9 17h6" /></>;
}

function ResultIcon({ icon }: { icon: SearchIconName }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#EEF3FF] text-[#2456E6]">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <SearchGlyph icon={icon} />
      </svg>
    </span>
  );
}

function GlobalSearch({ role }: { role: SessionUser["role"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const allowed = searchResults.filter((item) => item.roles.includes(role));
    const term = query.trim().toLowerCase();
    if (!term) return allowed.slice(0, 7);
    const terms = term.split(/\s+/).filter(Boolean);
    return allowed
      .map((item) => {
        const haystack = `${item.title} ${item.description} ${item.type} ${item.keywords}`.toLowerCase();
        const title = item.title.toLowerCase();
        const score = terms.reduce((total, part) => {
          if (title.includes(part)) return total + 4;
          if (haystack.includes(part)) return total + 1;
          return total - 8;
        }, 0);
        return { item, score };
      })
      .filter(({ score }) => score > -1)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
      .slice(0, 8)
      .map(({ item }) => item);
  }, [query, role]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function goTo(item: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(withSchoolPath(item.href, pathname));
  }

  return (
    <div className="relative hidden min-w-[280px] max-w-[540px] flex-1 md:block" ref={wrapperRef}>
      <div className={`flex h-10 items-center gap-2 rounded-[10px] border bg-[#F7F8FB] px-3 transition-all duration-200 ${open ? "border-[#2456E6] bg-white shadow-[0_10px_30px_-22px_rgba(36,86,230,0.85)] ring-4 ring-[#2456E6]/10" : "border-[#DCE1E8] hover:border-[#AAB4C0]"}`}>
        <svg className="h-4 w-4 shrink-0 text-[#5A6573]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          aria-label="Search modules, pages and functions"
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#0F1419] outline-none placeholder:text-[#8C96A3]"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && results[activeIndex]) {
              event.preventDefault();
              goTo(results[activeIndex]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search modules, pages, functions..."
          type="search"
          value={query}
        />
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[130] max-h-[min(440px,calc(100vh-88px))] overflow-y-auto rounded-[12px] border border-[#DCE1E8] bg-white/98 p-2 shadow-[0_18px_48px_-24px_rgba(15,20,25,0.5)] backdrop-blur-xl">
          {results.length ? (
            <div className="space-y-1">
              {results.map((item, index) => (
                <button
                  className={`flex w-full items-center gap-3 rounded-[9px] px-3 py-2.5 text-left transition ${index === activeIndex ? "bg-[#EEF3FF]" : "hover:bg-[#F7F8FB]"}`}
                  key={`${item.href}-${item.title}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => goTo(item)}
                  type="button"
                >
                  <ResultIcon icon={item.icon} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-[#0F1419]">{item.title}</span>
                    <span className="mt-0.5 block truncate text-[12px] font-medium text-[#5A6573]">{item.description}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#F0F3F7] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[#5A6573]">{item.type}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] font-bold text-[#0F1419]">No results found</p>
              <p className="mt-1 text-[12px] font-medium text-[#86868b]">Try student, fees, report, attendance, or settings.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
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

          <GlobalSearch role={user.role} />

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
