"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { activityApi, type ActivityLog, type ActivityLogResponse } from "@/lib/api";
import { formatDateShort, humanizeConstant } from "@/lib/formatters";

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function today() {
  return dateInputValue(new Date());
}

function monthStart() {
  const date = new Date();
  date.setDate(1);
  return dateInputValue(date);
}

function yearStart() {
  const date = new Date();
  date.setMonth(0, 1);
  return dateInputValue(date);
}

function parseDateValue(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function startOfMonthDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(date);
}

function calendarDays(month: Date) {
  const first = startOfMonthDate(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function dateRangeLabel(from: string, to: string) {
  if (!from && !to) return "All dates";
  if (from && to) return `${formatDateShort(from)} -> ${formatDateShort(to)}`;
  if (from) return `${formatDateShort(from)} -> Select end`;
  return `Until ${formatDateShort(to)}`;
}

function actorName(log: ActivityLog) {
  return log.actor?.fullName ?? "System";
}

function actionLabel(action: string) {
  if (action === "CREATE_OR_RUN") return "Create";
  if (action === "REPLACE") return "Update";
  return humanizeConstant(action);
}

function isUpdateAction(action: string) {
  return action === "REPLACE" || action === "UPDATE";
}

function moduleLabel(log: ActivityLog) {
  if (log.entityType === "AUTH") return "Account";
  const label = humanizeConstant(log.entityType);
  if (label.toLowerCase() === "students") return "Student";
  return label;
}

function bodyOf(log: ActivityLog) {
  return (log.afterJson?.body ?? {}) as Record<string, unknown>;
}

function targetName(log: ActivityLog) {
  const before = (log.beforeJson ?? {}) as Record<string, unknown>;
  const after = (log.afterJson ?? {}) as Record<string, unknown>;
  const body = bodyOf(log);
  const candidates = [after.fullName, body.fullName, before.fullName, after.name, body.name, body.studentName, body.title];
  const value = candidates.find((item) => typeof item === "string" && item.trim());
  return typeof value === "string" ? value : "";
}

type AttendanceRecord = { studentId: string; name: string; status: string };

function statusLabel(status: string) {
  if (status === "PRESENT") return "Present";
  if (status === "ABSENT") return "Absent";
  if (status === "HALF_DAY") return "Half day";
  if (status === "LATE") return "Late";
  return humanizeConstant(status);
}

function toAttendanceRecords(value: unknown): AttendanceRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.status !== "string") return [];
    return [{
      studentId: typeof record.studentId === "string" ? record.studentId : "",
      name: typeof record.name === "string" ? record.name : "",
      status: record.status
    }];
  });
}

function attendanceDetails(log: ActivityLog) {
  if (log.entityType !== "ATTENDANCE") return null;
  const after = (log.afterJson ?? {}) as Record<string, unknown>;
  const before = (log.beforeJson ?? {}) as Record<string, unknown>;
  const body = bodyOf(log);

  // New rich format stores named records on afterJson; older logs only have body.records (status only, no names).
  const records = after.records !== undefined ? toAttendanceRecords(after.records) : toAttendanceRecords(body.records);
  if (records.length === 0) return null;

  const beforeRecords = toAttendanceRecords(before.records);
  const hasNames = records.some((record) => record.name);

  const counts = records.reduce((acc, record) => {
    if (record.status === "PRESENT") acc.present += 1;
    if (record.status === "ABSENT") acc.absent += 1;
    if (record.status === "HALF_DAY") acc.halfDay += 1;
    if (record.status === "LATE") acc.late += 1;
    return acc;
  }, { present: 0, absent: 0, halfDay: 0, late: 0 });

  return {
    className: typeof after.className === "string" ? after.className : "",
    records,
    beforeRecords,
    isUpdate: beforeRecords.length > 0,
    hasNames,
    counts
  };
}

function authAction(log: ActivityLog) {
  if (log.entityType !== "AUTH") return null;
  const after = (log.afterJson ?? {}) as Record<string, unknown>;
  const path = typeof after.path === "string" ? after.path : "";
  if (path.includes("/auth/logout")) return "Signed out";
  if (path.includes("/auth/me/password")) return "Changed password";
  if (path.includes("/auth/me")) return "Updated profile";
  if (path.includes("/auth/login")) return "Signed in";
  if (path.includes("/auth/register")) return "Registered account";
  if (path.includes("/auth/forgot-password")) return "Requested password reset";
  return null;
}

function description(log: ActivityLog) {
  const attendance = attendanceDetails(log);
  if (attendance) {
    const verb = attendance.isUpdate ? "updated" : "marked";
    return `Attendance ${verb}${attendance.className ? ` for ${attendance.className}` : ""}`;
  }

  const auth = authAction(log);
  if (auth) return auth;

  if (!log.summary.includes(" /") && !log.summary.includes(" PATCH ") && !log.summary.includes(" POST ") && !log.summary.includes(" PUT ")) {
    return log.summary;
  }

  const target = targetName(log);
  const module = moduleLabel(log).toLowerCase();
  const action = actionLabel(log.action).toLowerCase();
  return `${action.charAt(0).toUpperCase() + action.slice(1)} ${module}${target ? ` ${target}` : ""}`;
}

const HIDDEN_DETAIL_KEYS = new Set(["id", "schoolId", "createdAt", "updatedAt", "passwordHash", "durationMs", "method", "path", "params", "query", "statusCode"]);

function displayValue(value: unknown, key = "") {
  if (value === null || value === undefined || value === "") return "Empty";
  if (value instanceof Date) return formatDateShort(value);
  if (typeof value === "number" && /(amount|balance|fee|paid|pending|total)/i.test(key)) {
    return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  }
  if (typeof value === "object") return "Details";
  return String(value);
}

function titleCase(value: string) {
  return humanizeConstant(value.replace(/\./g, " "));
}

function flattenDetails(value: unknown, prefix = ""): [string, unknown][] {
  if (!value || typeof value !== "object" || value instanceof Date) return prefix ? [[prefix, value]] : [];
  if (Array.isArray(value)) return prefix ? [[prefix, `${value.length} item${value.length === 1 ? "" : "s"}`]] : [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    if (HIDDEN_DETAIL_KEYS.has(key)) return [];
    const path = prefix ? `${prefix}.${key}` : key;
    if (!item || typeof item !== "object" || item instanceof Date || Array.isArray(item)) return [[path, item]];
    return flattenDetails(item, path);
  });
}

function diffLines(log: ActivityLog, labelsOnly = false) {
  const attendance = attendanceDetails(log);
  if (attendance) {
    if (attendance.isUpdate && attendance.hasNames) {
      const beforeStatus = new Map(attendance.beforeRecords.map((record) => [record.studentId, record.status]));
      const changes = attendance.records
        .filter((record) => beforeStatus.get(record.studentId) !== record.status)
        .map((record) => {
          const previous = beforeStatus.get(record.studentId);
          const name = record.name || "Student";
          return previous
            ? `${name}: ${statusLabel(previous)} -> ${statusLabel(record.status)}`
            : `${name}: ${statusLabel(record.status)} (newly added)`;
        });
      if (changes.length === 0) return ["No status changes"];
      const capped = changes.slice(0, 15);
      if (changes.length > capped.length) capped.push(`+${changes.length - capped.length} more changes`);
      return capped;
    }
    return [
      `Present: ${attendance.counts.present}`,
      `Absent: ${attendance.counts.absent}`,
      `Half day: ${attendance.counts.halfDay}`,
      `Late: ${attendance.counts.late}`
    ];
  }

  const auth = authAction(log);
  if (auth === "Signed out") return ["Session ended."];
  if (auth === "Changed password") return ["Account password was updated."];
  if (auth === "Signed in") return ["Signed in to the account."];
  if (auth === "Requested password reset") return ["A password reset link was requested."];

  const before = (log.beforeJson ?? {}) as Record<string, unknown>;
  const rawAfter = (log.afterJson ?? {}) as Record<string, unknown>;
  const body = bodyOf(log);
  const after = Object.keys(body).length > 0 ? body : rawAfter;
  const beforeFlat = new Map(flattenDetails(before));

  const lines = flattenDetails(after)
    .filter(([key, value]) => JSON.stringify(beforeFlat.get(key)) !== JSON.stringify(value))
    .slice(0, 12)
    .map(([key, value]) => {
      const label = titleCase(key);
      if (labelsOnly) return label;
      if (beforeFlat.has(key)) return `${label}: ${displayValue(beforeFlat.get(key), key)} -> ${displayValue(value, key)}`;
      return `${label}: ${displayValue(value, key)}`;
    });

  if (lines.length > 0) return lines;
  return [description(log)];
}

function logTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function ActivityLogsPage() {
  const [data, setData] = useState<ActivityLogResponse | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [openFilter, setOpenFilter] = useState<"action" | "actor" | "date" | "range" | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonthDate(new Date()));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [tooltip, setTooltip] = useState<{ desc: string; lines: string[]; x: number; y: number } | null>(null);
  const [domRowCount, setDomRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const headerCountRef = useRef<HTMLSpanElement>(null);
  const footerStartRef = useRef<HTMLSpanElement>(null);
  const footerEndRef = useRef<HTMLSpanElement>(null);
  const footerTotalRef = useRef<HTMLSpanElement>(null);

  function showTooltip(event: MouseEvent<HTMLElement>, desc: string, lines: string[]) {
    setTooltip({ desc, lines, x: event.clientX, y: event.clientY });
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    activityApi.logs({
      action: actionFilter,
      actorId: actorFilter,
      dateFrom,
      dateTo,
      limit,
      page,
      search: search.trim()
    })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load activity logs");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [actionFilter, actorFilter, dateFrom, dateTo, limit, page, search]);

  const rows = data?.items ?? [];
  useEffect(() => {
    const renderedRows = tableBodyRef.current?.querySelectorAll("[data-activity-log-row]").length ?? rows.length;
    setDomRowCount(renderedRows);

    const apiTotalNow = Number(data?.meta.total ?? 0);
    const apiHeaderTotalNow = Number(data?.stats.totalCount ?? 0);
    const visibleFloorTotal = renderedRows > 0 ? (page - 1) * limit + renderedRows : 0;
    const resolvedTotal = Math.max(apiTotalNow, apiHeaderTotalNow, visibleFloorTotal);
    const resolvedStart = renderedRows > 0 ? (page - 1) * limit + 1 : 0;
    const resolvedEnd = renderedRows > 0 ? (page - 1) * limit + renderedRows : 0;

    if (headerCountRef.current) headerCountRef.current.textContent = String(resolvedTotal);
    if (footerStartRef.current) footerStartRef.current.textContent = String(resolvedStart);
    if (footerEndRef.current) footerEndRef.current.textContent = String(resolvedEnd);
    if (footerTotalRef.current) footerTotalRef.current.textContent = String(resolvedTotal);
  }, [data?.meta.total, data?.stats.totalCount, limit, loading, page, rows.length]);

  const apiTotal = Number(data?.meta.total ?? 0);
  const apiHeaderTotal = Number(data?.stats.totalCount ?? 0);
  const visibleCount = Math.max(rows.length, domRowCount);
  const visibleFloorTotal = visibleCount > 0 ? (page - 1) * limit + visibleCount : 0;
  const total = Math.max(apiTotal, apiHeaderTotal, visibleFloorTotal);
  const headerCount = Math.max(apiHeaderTotal, total);
  const start = visibleCount > 0 ? (page - 1) * limit + 1 : 0;
  const end = visibleCount > 0 ? (page - 1) * limit + visibleCount : 0;
  const pageNumbers = useMemo(() => {
    const totalPages = data?.meta.totalPages ?? 1;
    const first = Math.max(1, Math.min(page - 2, Math.max(1, totalPages - 4)));
    return Array.from({ length: Math.min(5, totalPages) }, (_, index) => first + index);
  }, [data?.meta.totalPages, page]);

  function exportExcel() {
    const header = ["Module", "Description", "Action", "Action By", "Log Date", "Log Time"];
    const body = rows.map((log) => [
      moduleLabel(log),
      description(log),
      actionLabel(log.action),
      actorName(log),
      formatDateShort(log.createdAt),
      logTime(log.createdAt)
    ]);
    const csv = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\n");
    download(`activity-logs-${dateFrom}-${dateTo}.csv`, csv, "text/csv;charset=utf-8");
    setActionsOpen(false);
  }

  function exportPdf() {
    window.print();
    setActionsOpen(false);
  }

  function setDatePreset(preset: "all" | "today" | "month" | "year") {
    setPage(1);
    setOpenFilter(null);
    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    } else if (preset === "today") {
      setDateFrom(today());
      setDateTo(today());
    } else if (preset === "month") {
      setDateFrom(monthStart());
      setDateTo(today());
    } else {
      setDateFrom(yearStart());
      setDateTo(today());
    }
  }

  function pickCalendarDate(date: Date) {
    const value = dateInputValue(date);
    setPage(1);
    if (!dateFrom || dateTo || value < dateFrom) {
      setDateFrom(value);
      setDateTo("");
      return;
    }
    setDateTo(value);
    setOpenFilter(null);
  }

  function isCalendarDateSelected(value: string) {
    return value === dateFrom || value === dateTo;
  }

  function isCalendarDateInRange(value: string) {
    return Boolean(dateFrom && dateTo && value > dateFrom && value < dateTo);
  }

  function CalendarGrid() {
    const selectedMonth = calendarMonth.getMonth();
    const selectedYear = calendarMonth.getFullYear();
    const days = calendarDays(calendarMonth);

    return (
      <div className="w-full rounded-[6px] border border-[#C9D3DE] bg-white p-3 sm:w-[308px]">
        <div className="mb-3 flex items-center justify-between">
          <button className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[#D7DEE8] text-[#2456E6] hover:bg-[#F2F7FC]" onClick={() => setCalendarMonth((value) => addMonths(value, -1))} type="button">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <p className="text-[15px] font-semibold text-[#031526]">{monthLabel(calendarMonth)}</p>
          <button className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[#D7DEE8] text-[#2456E6] hover:bg-[#F2F7FC]" onClick={() => setCalendarMonth((value) => addMonths(value, 1))} type="button">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-[#7A8390]">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const value = dateInputValue(day);
            const selected = isCalendarDateSelected(value);
            const inRange = isCalendarDateInRange(value);
            const muted = day.getMonth() !== selectedMonth || day.getFullYear() !== selectedYear;
            return (
              <button
                className={`h-9 rounded-[5px] text-[13px] font-semibold transition ${
                  selected
                    ? "bg-[#2456E6] text-white"
                    : inRange
                      ? "bg-[#EAF1FF] text-[#2456E6]"
                      : muted
                        ? "text-[#A7B1BD] hover:bg-[#F5F8FC]"
                        : "text-[#031526] hover:bg-[#F2F7FC]"
                }`}
                key={value}
                onClick={() => pickCalendarDate(day)}
                type="button"
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function HeaderFilter({
    children,
    filterKey
  }: {
    children: ReactNode;
    filterKey: "action" | "actor" | "date";
  }) {
    const open = openFilter === filterKey;
    return (
      <button
        className="inline-flex items-center gap-2 text-left"
        onClick={() => setOpenFilter(open ? null : filterKey)}
        type="button"
      >
        {children}
        <svg className="h-4 w-4 text-[#52687D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="m8 9 4-4 4 4M16 15l-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <div className="space-y-5 print:bg-white">
      <section className="overflow-hidden rounded-[6px] border border-[#C9D3DE] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
        <div className="border-b border-[#C9D3DE] px-4 py-5 sm:px-6 sm:py-6">
          <h1 className="text-[22px] font-semibold text-[#031526]">
            Activity Logs <span className="text-[#2456E6]" data-count-fix="dom-v2" ref={headerCountRef}>{headerCount}</span>
          </h1>
        </div>

        <div className="flex flex-col gap-4 border-b border-[#C9D3DE] px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <button
                className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[5px] border border-[#C9D3DE] bg-white px-4 text-left text-[14px] font-semibold text-[#031526] transition hover:border-[#2456E6] sm:text-[15px] lg:min-w-[300px]"
                onClick={() => {
                  const anchorDate = parseDateValue(dateFrom || dateTo) ?? new Date();
                  setCalendarMonth(startOfMonthDate(anchorDate));
                  setOpenFilter(openFilter === "range" ? null : "range");
                }}
                type="button"
              >
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-[#2456E6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M8 2v4M16 2v4M4 10h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {dateRangeLabel(dateFrom, dateTo)}
                </span>
                <svg className={`h-4 w-4 text-[#52687D] transition ${openFilter === "range" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {openFilter === "range" ? (
                <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[calc(100vw-32px)] rounded-[6px] border border-[#C9D3DE] bg-white p-4 shadow-[0_14px_34px_rgba(15,20,25,0.18)] sm:w-[560px]">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex min-w-[180px] flex-col gap-2">
                      {([
                        ["all", "All dates"],
                        ["today", "Today"],
                        ["month", "This month"],
                        ["year", "This year"]
                      ] as const).map(([preset, label]) => (
                        <button
                          className="rounded-[5px] border border-[#D7DEE8] px-3 py-2 text-left text-[14px] font-semibold text-[#031526] hover:border-[#2456E6] hover:bg-[#F2F7FC]"
                          key={preset}
                          onClick={() => setDatePreset(preset)}
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                      <div className="mt-2 rounded-[5px] bg-[#F5F8FC] p-3 text-[12px] font-semibold leading-5 text-[#52687D]">
                        Select start date, then end date.
                      </div>
                    </div>
                    <CalendarGrid />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[#E2E8F0] pt-3">
                    <p className="text-[13px] font-semibold text-[#52687D]">{dateRangeLabel(dateFrom, dateTo)}</p>
                    <div className="flex gap-2">
                      <button className="rounded-[5px] border border-[#D7DEE8] px-3 py-2 text-[13px] font-semibold text-[#52687D] hover:bg-[#F2F7FC]" onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }} type="button">Reset</button>
                      <button className="rounded-[5px] bg-[#2456E6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1B45BD]" onClick={() => setOpenFilter(null)} type="button">Done</button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <input
              className="min-h-[48px] w-full rounded-[5px] border border-[#C9D3DE] px-4 text-[15px] font-medium outline-none transition focus:border-[#2456E6] lg:w-[280px]"
              onChange={(event) => { setPage(1); setSearch(event.target.value); }}
              placeholder="Search logs"
              value={search}
            />
            <button className="min-h-[48px] rounded-[5px] bg-[#2456E6] px-7 text-[16px] font-semibold text-white transition hover:bg-[#1B45BD]" type="button">
              Search
            </button>
          </div>

          <div className="relative print:hidden">
            <button
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[5px] border border-[#C9D3DE] bg-white px-5 text-[16px] font-semibold text-[#031526] transition hover:border-[#2456E6] sm:w-auto"
              onClick={() => setActionsOpen((value) => !value)}
              type="button"
            >
              Actions
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {actionsOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-[5px] border border-[#C9D3DE] bg-white py-1 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
                <button className="block w-full px-5 py-2.5 text-left text-[15px] font-medium text-[#424B57] hover:bg-[#F2F7FC]" onClick={exportExcel} type="button">Export Excel</button>
                <button className="block w-full px-5 py-2.5 text-left text-[15px] font-medium text-[#424B57] hover:bg-[#F2F7FC]" onClick={exportPdf} type="button">Export PDF</button>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <div className="mx-4 mt-5 rounded-md bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C] sm:mx-6">{error}</div> : null}

        <div className="space-y-3 px-4 py-4 md:hidden">
          {loading ? (
            Array.from({ length: Math.min(limit, 6) }).map((_, index) => (
              <div className="animate-pulse rounded-xl border border-[#DCE1E8] bg-white p-4" key={`activity-mobile-skeleton-${index}`}>
                <div className="h-4 w-24 rounded bg-[#E8EDF3]" />
                <div className="mt-3 h-4 w-48 rounded bg-[#E8EDF3]" />
                <div className="mt-4 h-16 rounded bg-[#F2F5F8]" />
              </div>
            ))
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-[#DCE1E8] bg-white px-4 py-10 text-center text-[13px] font-medium text-[#52687D]">No activity logs found for this filter.</div>
          ) : (
            rows.map((log) => {
              const desc = description(log);
              const lines = diffLines(log).slice(0, 4);
              return (
                <article className="rounded-xl border border-[#DCE1E8] bg-white p-4 shadow-[0_8px_22px_-18px_rgba(15,20,25,0.35)]" key={`activity-mobile-${log.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#0F1419]">{moduleLabel(log)}</p>
                      <p className="mt-1 text-[12px] font-medium text-[#6E7A88]">{formatDateShort(log.createdAt)} at {logTime(log.createdAt)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#EEF3FF] px-2.5 py-1 text-[11px] font-bold text-[#2456E6]">{actionLabel(log.action)}</span>
                  </div>
                  <p className="mt-3 text-[14px] font-semibold leading-5 text-[#1D2733]">{desc}</p>
                  <div className="mt-3 rounded-lg bg-[#F7F8FB] px-3 py-3">
                    {lines.map((line) => (
                      <p className="text-[12px] font-medium leading-5 text-[#52687D]" key={line}>{line}</p>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#EEF1F5] pt-3">
                    <span className="text-[12px] font-semibold text-[#52687D]">Action by</span>
                    <span className="truncate text-right text-[12px] font-semibold text-[#0F1419]">{actorName(log)}</span>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="hidden px-5 py-5 md:block">
          <div className="overflow-x-auto rounded-[5px] border border-[#C9D3DE]">
            <table className="w-full min-w-[980px] border-collapse text-left text-[15px] text-[#001B33]">
              <thead>
                <tr className="table-head-row">
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[15px] font-semibold">Module</th>
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[15px] font-semibold">Description</th>
                  <th className="relative whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[15px] font-semibold">
                    <HeaderFilter filterKey="action">Action</HeaderFilter>
                    {openFilter === "action" ? (
                      <div className="absolute left-4 top-12 z-30 w-48 overflow-hidden rounded-[5px] border border-[#C9D3DE] bg-white py-1 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
                        <button className="block w-full px-4 py-2 text-left text-[14px] font-medium text-[#031526] hover:bg-[#F2F7FC]" onClick={() => { setActionFilter(""); setPage(1); setOpenFilter(null); }} type="button">All actions</button>
                        {(data?.filters.actions ?? []).map((action) => (
                          <button className="block w-full px-4 py-2 text-left text-[14px] font-medium text-[#031526] hover:bg-[#F2F7FC]" key={action} onClick={() => { setActionFilter(action); setPage(1); setOpenFilter(null); }} type="button">
                            {actionLabel(action)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </th>
                  <th className="relative whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[15px] font-semibold">
                    <HeaderFilter filterKey="actor">Action By</HeaderFilter>
                    {openFilter === "actor" ? (
                      <div className="absolute left-4 top-12 z-30 w-56 overflow-hidden rounded-[5px] border border-[#C9D3DE] bg-white py-1 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
                        <button className="block w-full px-4 py-2 text-left text-[14px] font-medium text-[#031526] hover:bg-[#F2F7FC]" onClick={() => { setActorFilter(""); setPage(1); setOpenFilter(null); }} type="button">All users</button>
                        {(data?.filters.actors ?? []).map((actor) => (
                          <button className="block w-full px-4 py-2 text-left text-[14px] font-medium text-[#031526] hover:bg-[#F2F7FC]" key={actor.id} onClick={() => { setActorFilter(actor.id); setPage(1); setOpenFilter(null); }} type="button">
                            {actor.fullName}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </th>
                  <th className="relative whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[15px] font-semibold">
                    <button className="text-left" onClick={() => setOpenFilter(openFilter === "date" ? null : "date")} type="button">Log Date</button>
                    {openFilter === "date" ? (
                      <div className="absolute left-4 top-12 z-30 w-44 overflow-hidden rounded-[5px] border border-[#C9D3DE] bg-white py-1 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
                        <button className="block w-full px-4 py-2 text-left text-[14px] font-medium text-[#031526] hover:bg-[#F2F7FC]" onClick={() => setDatePreset("all")} type="button">All dates</button>
                        <button className="block w-full px-4 py-2 text-left text-[14px] font-medium text-[#031526] hover:bg-[#F2F7FC]" onClick={() => setDatePreset("today")} type="button">Today</button>
                        <button className="block w-full px-4 py-2 text-left text-[14px] font-medium text-[#031526] hover:bg-[#F2F7FC]" onClick={() => setDatePreset("month")} type="button">This month</button>
                        <button className="block w-full px-4 py-2 text-left text-[14px] font-medium text-[#031526] hover:bg-[#F2F7FC]" onClick={() => setDatePreset("year")} type="button">This year</button>
                      </div>
                    ) : null}
                  </th>
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[15px] font-semibold">Log Time</th>
                </tr>
              </thead>
              <tbody ref={tableBodyRef}>
                {loading ? (
                  Array.from({ length: limit }).map((_, index) => (
                    <tr key={index}>
                      <td className="border-b border-[#C9D3DE] px-4 py-5" colSpan={6}>
                        <div className="h-4 w-full animate-pulse rounded bg-[#F1F5F9]" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-[#52687D]" colSpan={6}>No activity logs found for this filter.</td>
                  </tr>
                ) : (
                  rows.map((log) => {
                    const desc = description(log);
                    const lines = diffLines(log, isUpdateAction(log.action));
                    return (
                      <tr className="transition-colors hover:bg-[#F8FBFD]" data-activity-log-row key={log.id}>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4">{moduleLabel(log)}</td>
                        <td className="border-b border-[#C9D3DE] px-4 py-4">
                          <span
                            className="inline-block max-w-[520px] cursor-default truncate align-bottom decoration-[#2456E6] underline-offset-4 hover:text-[#2456E6] hover:underline"
                            onMouseEnter={(event) => showTooltip(event, desc, lines)}
                            onMouseMove={(event) => showTooltip(event, desc, lines)}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            {desc}
                          </span>
                        </td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4">{actionLabel(log.action)}</td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4">{actorName(log)}</td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4">{formatDateShort(log.createdAt)}</td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4">{logTime(log.createdAt)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-[14px] font-semibold text-[#52687D] sm:text-left sm:text-[15px]">
            Showing <span className="text-[#0F1419]" ref={footerStartRef}>{start}</span> to <span className="text-[#0F1419]" ref={footerEndRef}>{end}</span> of <span className="text-[#0F1419]" ref={footerTotalRef}>{total}</span> Results
          </p>
          <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 print:hidden sm:w-auto sm:flex-wrap sm:gap-3 sm:pb-0">
            <select className="min-h-[44px] shrink-0 rounded-[5px] border border-[#C9D3DE] bg-white px-3 text-[14px] font-semibold outline-none sm:px-4 sm:text-[15px]" onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} value={limit}>
              {[10, 25, 50, 100].map((item) => <option key={item} value={item}>{item} / Page</option>)}
            </select>
            <button className="min-h-[44px] shrink-0 rounded-[5px] border border-[#C9D3DE] px-3 text-[14px] font-semibold text-[#7A8390] disabled:opacity-50 sm:px-4 sm:text-[15px]" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Previous</button>
            {pageNumbers.map((item) => (
              <button className={`min-h-[44px] min-w-[44px] shrink-0 rounded-[5px] border px-3 text-[14px] font-semibold sm:text-[15px] ${item === page ? "border-[#2456E6] bg-[#2456E6] text-white" : "border-[#C9D3DE] bg-white text-[#2456E6]"}`} key={item} onClick={() => setPage(item)} type="button">
                {item}
              </button>
            ))}
            <button className="min-h-[44px] shrink-0 rounded-[5px] border border-[#C9D3DE] px-3 text-[14px] font-semibold text-[#2456E6] disabled:opacity-50 sm:px-4 sm:text-[15px]" disabled={!data || page >= data.meta.totalPages} onClick={() => setPage((value) => value + 1)} type="button">Next</button>
          </div>
        </div>
        {tooltip ? (() => {
          const width = Math.min(520, window.innerWidth - 32);
          const height = Math.min(360, 56 + tooltip.lines.length * 24);
          const left = Math.min(Math.max(16, tooltip.x - width / 2), window.innerWidth - width - 16);
          const top = tooltip.y + height + 24 > window.innerHeight ? Math.max(16, tooltip.y - height - 18) : tooltip.y + 18;

          return (
            <div
              className="pointer-events-none fixed z-50 max-h-[360px] overflow-y-auto rounded-[5px] bg-[#001827] px-4 py-3 text-[15px] font-semibold leading-6 text-white shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
              style={{ left, top, width }}
            >
              <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#001827]" />
              <span className="relative block whitespace-normal">
                <span className="mb-1 block">{tooltip.desc}</span>
                {tooltip.lines.map((line) => (
                  <span className="block" key={line}>- {line}</span>
                ))}
              </span>
            </div>
          );
        })() : null}
      </section>
    </div>
  );
}
