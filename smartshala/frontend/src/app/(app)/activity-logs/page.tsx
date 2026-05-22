"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { activityApi, type ActivityLog, type ActivityLogResponse } from "@/lib/api";
import { formatDateShort, humanizeConstant } from "@/lib/formatters";

const BRAND_BLUE = "#2456E6";

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function yearStart() {
  const date = new Date();
  date.setMonth(0, 1);
  return dateInputValue(date);
}

function today() {
  return dateInputValue(new Date());
}

function actorName(log: ActivityLog) {
  return log.actor?.fullName ?? "System";
}

function actionLabel(action: string) {
  if (action === "CREATE_OR_RUN") return "Create";
  if (action === "REPLACE") return "Update";
  return humanizeConstant(action);
}

function moduleLabel(log: ActivityLog) {
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

function description(log: ActivityLog) {
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

function diffLines(log: ActivityLog) {
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
  const [dateFrom, setDateFrom] = useState(yearStart());
  const [dateTo, setDateTo] = useState(today());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [tooltip, setTooltip] = useState<{ desc: string; lines: string[]; x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function showTooltip(event: MouseEvent<HTMLElement>, desc: string, lines: string[]) {
    setTooltip({ desc, lines, x: event.clientX, y: event.clientY });
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    activityApi.logs({ dateFrom, dateTo, limit, page, search: search.trim() })
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
  }, [dateFrom, dateTo, limit, page, search]);

  const rows = data?.items ?? [];
  const total = data?.meta.total ?? rows.length;
  const headerCount = data?.stats.totalCount ?? data?.meta.total ?? rows.length;
  const start = total > 0 ? (page - 1) * limit + 1 : 0;
  const end = total > 0 ? Math.min(page * limit, total) : 0;
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

  return (
    <div className="space-y-5 print:bg-white">
      <section className="overflow-hidden rounded-[6px] border border-[#C9D3DE] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
        <div className="border-b border-[#C9D3DE] px-6 py-6">
          <h1 className="text-[22px] font-semibold text-[#031526]">
            Activity Logs <span className="text-[#2456E6]">{headerCount}</span>
          </h1>
        </div>

        <div className="flex flex-col gap-4 border-b border-[#C9D3DE] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-h-[48px] items-center gap-3 rounded-[5px] border border-[#C9D3DE] bg-white px-4 text-[16px] font-medium text-[#031526]">
              <input aria-label="From date" className="w-[136px] bg-transparent outline-none" onChange={(event) => { setPage(1); setDateFrom(event.target.value); }} type="date" value={dateFrom} />
              <span className="text-[#9AA5B1]">-&gt;</span>
              <input aria-label="To date" className="w-[136px] bg-transparent outline-none" onChange={(event) => { setPage(1); setDateTo(event.target.value); }} type="date" value={dateTo} />
            </div>
            <input
              className="min-h-[48px] w-[280px] rounded-[5px] border border-[#C9D3DE] px-4 text-[15px] font-medium outline-none transition focus:border-[#2456E6]"
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
              className="inline-flex min-h-[48px] items-center gap-2 rounded-[5px] border border-[#C9D3DE] bg-white px-5 text-[16px] font-semibold text-[#031526] transition hover:border-[#2456E6]"
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

        {error ? <div className="mx-6 mt-5 rounded-md bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}

        <div className="px-5 py-5">
          <div className="overflow-x-auto rounded-[5px] border border-[#C9D3DE]">
            <table className="w-full min-w-[980px] border-collapse text-left text-[15px] text-[#001B33]">
              <thead>
                <tr className="bg-[#DDECF8]">
                  {["Module", "Description", "Action", "Action By", "Log Date", "Log Time"].map((head) => (
                    <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[15px] font-semibold" key={head}>
                      <span className="inline-flex items-center gap-2">
                        {head}
                        {head !== "Module" ? (
                          <svg className="h-4 w-4 text-[#52687D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path d="m8 9 4-4 4 4M16 15l-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : null}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
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
                    const lines = diffLines(log);
                    return (
                      <tr className="transition-colors hover:bg-[#F8FBFD]" key={log.id}>
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

        <div className="flex flex-col gap-4 px-2 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="px-3 text-[15px] font-semibold text-[#52687D]">
            Showing <span className="text-[#0F1419]">{start}</span> to <span className="text-[#0F1419]">{end}</span> of <span className="text-[#0F1419]">{total}</span> Results
          </p>
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <select className="min-h-[44px] rounded-[5px] border border-[#C9D3DE] bg-white px-4 text-[15px] font-semibold outline-none" onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} value={limit}>
              {[10, 25, 50, 100].map((item) => <option key={item} value={item}>{item} / Page</option>)}
            </select>
            <button className="min-h-[44px] rounded-[5px] border border-[#C9D3DE] px-4 text-[15px] font-semibold text-[#7A8390] disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Previous</button>
            {pageNumbers.map((item) => (
              <button className={`min-h-[44px] min-w-[44px] rounded-[5px] border px-3 text-[15px] font-semibold ${item === page ? "border-[#2456E6] bg-[#2456E6] text-white" : "border-[#C9D3DE] bg-white text-[#2456E6]"}`} key={item} onClick={() => setPage(item)} type="button">
                {item}
              </button>
            ))}
            <button className="min-h-[44px] rounded-[5px] border border-[#C9D3DE] px-4 text-[15px] font-semibold text-[#2456E6] disabled:opacity-50" disabled={!data || page >= data.meta.totalPages} onClick={() => setPage((value) => value + 1)} type="button">Next</button>
          </div>
        </div>
        {tooltip ? (
          <div
            className="pointer-events-none fixed z-50 w-[520px] max-w-[calc(100vw-32px)] rounded-[5px] bg-[#001827] px-4 py-3 text-[15px] font-semibold leading-6 text-white shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
            style={{
              left: Math.min(Math.max(16, tooltip.x - 240), window.innerWidth - 536),
              top: Math.min(tooltip.y + 18, window.innerHeight - 220)
            }}
          >
            <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#001827]" />
            <span className="relative block whitespace-normal">
              <span className="mb-1 block">{tooltip.desc}</span>
              {tooltip.lines.map((line) => (
                <span className="block" key={line}>- {line}</span>
              ))}
            </span>
          </div>
        ) : null}
      </section>
    </div>
  );
}
