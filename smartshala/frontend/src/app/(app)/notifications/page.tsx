"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { StatCardSkeleton, TableRowSkeleton } from "@/components/ui/Skeleton";
import { type NotificationLog, type NotificationStats, whatsappApi } from "@/lib/api";
import { formatDateTimeShort, humanizeConstant, maskPhoneNumber, truncateText } from "@/lib/formatters";
import { cachedFetch, invalidateCache } from "@/lib/prefetchCache";

type TypeFilter = "all" | NotificationLog["kind"];
type DeliveryStatus = "Queued" | "Sent" | "Failed";
type StatusFilter = "all" | DeliveryStatus;
type TimeFilter = "all" | "today" | "3d" | "1w" | "1m";
type FilterKey = "type" | "status" | "time";

const notificationKinds: NotificationLog["kind"][] = [
  "ABSENCE",
  "LOW_ATTENDANCE",
  "FEE_REMINDER",
  "OVERDUE_FEE",
  "PAYMENT_RECEIPT",
  "MONTHLY_REPORT",
  "SCHOOL_ALERT"
];
const statusOptions = ["Sent", "Failed", "Queued"] as DeliveryStatus[];
const timeOptions: { label: string; value: TimeFilter }[] = [
  { label: "Today", value: "today" },
  { label: "Past 3 days", value: "3d" },
  { label: "Past one week", value: "1w" },
  { label: "Past one month", value: "1m" },
  { label: "All time", value: "all" }
];

const filterLabels: Record<FilterKey, string> = {
  type: "Type",
  status: "Status",
  time: "Time"
};

function deliveryStatus(log: NotificationLog): DeliveryStatus {
  if (log.status === "FAILED") return "Failed";
  if (log.status === "QUEUED") return "Queued";
  return "Sent";
}

function statusTone(status: DeliveryStatus) {
  if (status === "Sent") return "good";
  if (status === "Failed") return "danger";
  return "warn";
}

function formatTime(value: string | null) {
  if (!value) return "Not sent";
  return formatDateTimeShort(value);
}

function senderName(log: NotificationLog) {
  return log.sentBy?.fullName ?? "System";
}

function senderRole(log: NotificationLog) {
  return log.sentBy?.role ? humanizeConstant(log.sentBy.role) : "System";
}

function isToday(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

function timeMatches(value: string | null, filter: TimeFilter) {
  if (filter === "all") return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (filter === "today") return date.getTime() >= start.getTime();
  const days = filter === "3d" ? 3 : filter === "1w" ? 7 : 30;
  start.setDate(start.getDate() - (days - 1));
  return date.getTime() >= start.getTime();
}

export default function NotificationsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [time, setTime] = useState<TimeFilter>("all");
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [hoveredLog, setHoveredLog] = useState<{ message: string; x: number; y: number } | null>(null);
  const [hoveredSender, setHoveredSender] = useState<{ name: string; role: string; x: number; y: number } | null>(null);
  const [retryingId, setRetryingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterMenu, setFilterMenu] = useState<{ key: FilterKey; x: number; y: number; width: number } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const range = todayRange();
    Promise.all([
      cachedFetch("notifications:logs", () => whatsappApi.logs()),
      cachedFetch(`notifications:stats:${range.dateFrom}:${range.dateTo}`, () => whatsappApi.stats(range))
    ])
      .then(([data, nextStats]) => {
        if (active) {
          setLogs(data);
          setStats(nextStats);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load WhatsApp logs");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredLogs = useMemo(() => logs.filter((log) => {
    const typeMatches = type === "all" || log.kind === type;
    const statusMatches = status === "all" || deliveryStatus(log) === status;
    const timeFilterMatches = timeMatches(log.sentAt ?? log.createdAt, time);
    return typeMatches && statusMatches && timeFilterMatches;
  }), [logs, status, time, type]);

  const sentToday = stats?.sentToday ?? logs.filter((log) => log.status === "SENT" && isToday(log.sentAt ?? log.createdAt)).length;
  const failedCount = stats?.failedCount ?? logs.filter((log) => log.status === "FAILED").length;
  const creditsRemaining = stats?.creditsRemaining ?? Math.max(0, 5000 - logs.filter((log) => isToday(log.createdAt)).length);

  async function refreshLogsAndStats() {
    const range = todayRange();
    const [nextLogs, nextStats] = await Promise.all([whatsappApi.logs(), whatsappApi.stats(range)]);
    invalidateCache("notifications:logs");
    invalidateCache(`notifications:stats:${range.dateFrom}:${range.dateTo}`);
    setLogs(nextLogs);
    setStats(nextStats);
  }

  async function retryLog(log: NotificationLog) {
    setRetryingId(log.id);
    setError("");
    setNotice("");
    try {
      await whatsappApi.retry(log.id);
      await refreshLogsAndStats();
      setNotice(`Retry queued for ${maskPhoneNumber(log.recipientPhone)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retry WhatsApp message");
    } finally {
      setRetryingId("");
    }
  }

  function showMessageTooltip(event: MouseEvent<HTMLElement>, message: string) {
    setHoveredLog({ message, x: event.clientX, y: event.clientY });
  }

  function showSenderTooltip(event: MouseEvent<HTMLElement>, log: NotificationLog) {
    setHoveredSender({ name: senderName(log), role: senderRole(log), x: event.clientX, y: event.clientY });
  }

  function openFilterMenu(event: MouseEvent<HTMLButtonElement>, key: FilterKey) {
    const rect = event.currentTarget.getBoundingClientRect();
    setFilterMenu({
      key,
      x: Math.min(Math.max(16, rect.left), window.innerWidth - 240),
      y: Math.min(rect.bottom + 8, window.innerHeight - 260),
      width: Math.max(180, rect.width)
    });
  }

  function applyFilter(key: FilterKey, value: string) {
    if (key === "type") setType(value as TypeFilter);
    if (key === "status") setStatus(value as StatusFilter);
    if (key === "time") setTime(value as TimeFilter);
    setFilterMenu(null);
  }

  function filterOptions(key: FilterKey) {
    if (key === "type") return [{ label: "All types", value: "all" }, ...notificationKinds.map((kind) => ({ label: humanizeConstant(kind), value: kind }))];
    if (key === "status") return [{ label: "All status", value: "all" }, ...statusOptions.map((item) => ({ label: item, value: item }))];
    return timeOptions;
  }

  function filterValue(key: FilterKey) {
    if (key === "type") return type;
    if (key === "status") return status;
    return time;
  }

  function FilterHeader({ label, filterKey }: { label: string; filterKey: FilterKey }) {
    const active = filterValue(filterKey) !== "all";
    return (
      <button
        aria-expanded={filterMenu?.key === filterKey}
        className="inline-flex items-center justify-center gap-1.5 rounded-md px-1 py-0.5 hover:text-[#2456E6]"
        onClick={(event) => openFilterMenu(event, filterKey)}
        type="button"
      >
        <span>{label}</span>
        <svg className={`h-3.5 w-3.5 ${active ? "text-[#2456E6]" : "text-[#52687D]"}`} fill="none" viewBox="0 0 24 24">
          <path d="m8 10 4-4 4 4M16 14l-4 4-4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>
    );
  }

  async function deleteLog(log: NotificationLog) {
    setDeletingId(log.id);
    setError("");
    setNotice("");
    try {
      await whatsappApi.delete(log.id);
      await refreshLogsAndStats();
      setNotice("Notification cleared.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to clear notification");
    } finally {
      setDeletingId("");
    }
  }

  async function clearLogs() {
    setClearing(true);
    setError("");
    setNotice("");
    try {
      const result = await whatsappApi.clear();
      invalidateCache("notifications:logs");
      setLogs([]);
      setStats({ sentToday: 0, failedCount: 0, todaysUsage: 0, creditsRemaining: 5000 });
      setNotice(`Cleared ${result.count} notification${result.count === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to clear notifications");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Parent notification logs"
        action={(
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button className="rounded-lg border border-[#D6DCE5] bg-white px-4 py-2 text-[13px] font-semibold text-[#D92D20] hover:bg-[#FFF1F0] disabled:opacity-50" disabled={logs.length === 0 || clearing} onClick={clearLogs} type="button">
              {clearing ? "Clearing..." : "Clear notifications"}
            </button>
            <button className="btn-primary">Send message</button>
          </div>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <div className="kpi-metric-card kpi-metric-card-good p-6">
              <p className="kpi-metric-label">Total sent today</p>
              <p className="kpi-metric-value">{sentToday}</p>
            </div>
            <div className="kpi-metric-card kpi-metric-card-danger p-6">
              <p className="kpi-metric-label">Failed count</p>
              <p className="kpi-metric-value">{failedCount}</p>
            </div>
            <div className="kpi-metric-card p-6">
              <p className="kpi-metric-label">Credits remaining</p>
              <p className="kpi-metric-value">{creditsRemaining.toLocaleString("en-IN")}</p>
            </div>
          </>
        )}
      </section>

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}
      {notice ? <div className="rounded-xl bg-[#34c759]/10 px-4 py-3 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}

      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div className="animate-pulse rounded-xl border border-[#DCE1E8] bg-white p-4" key={`mobile-skeleton-${index}`}>
              <div className="h-4 w-28 rounded bg-[#E8EDF3]" />
              <div className="mt-3 h-4 w-44 rounded bg-[#E8EDF3]" />
              <div className="mt-4 h-16 rounded bg-[#F2F5F8]" />
            </div>
          ))
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-xl border border-[#DCE1E8] bg-white px-4 py-10 text-center text-[13px] font-medium text-[#86868b]">No notification logs found.</div>
        ) : (
          filteredLogs.map((log) => {
            const displayStatus = deliveryStatus(log);
            return (
              <article className="rounded-xl border border-[#DCE1E8] bg-white p-4 shadow-[0_8px_22px_-18px_rgba(15,20,25,0.35)]" key={`mobile-${log.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F1419]">{humanizeConstant(log.kind)}</p>
                    <p className="mt-1 truncate text-[12px] font-medium text-[#5A6573]">
                      {maskPhoneNumber(log.recipientPhone)}{log.student ? ` · ${log.student.fullName}` : ""}
                    </p>
                    <button
                      className="mt-1 truncate text-left text-[12px] font-medium text-[#2456E6]"
                      onClick={() => setHoveredSender({ name: senderName(log), role: senderRole(log), x: window.innerWidth / 2, y: 180 })}
                      type="button"
                    >
                      Sent by {senderRole(log)}
                    </button>
                  </div>
                  <StatusPill label={displayStatus} tone={statusTone(displayStatus)} />
                </div>
                <button
                  className="mt-3 block w-full rounded-lg bg-[#F7F8FB] px-3 py-3 text-left text-[13px] font-medium leading-5 text-[#2A3340]"
                  onClick={() => { setHoveredLog(null); setSelectedLog(log); }}
                  type="button"
                >
                  {truncateText(log.message, 130)}
                </button>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] font-medium text-[#6e6e73]">{formatTime(log.sentAt ?? log.createdAt)}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-[#F2B8B5] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#D92D20] disabled:opacity-50"
                      disabled={deletingId === log.id}
                      onClick={() => deleteLog(log)}
                      type="button"
                    >
                      {deletingId === log.id ? "Clearing..." : "Clear"}
                    </button>
                    {log.status === "FAILED" ? (
                      <button
                        className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2456E6] disabled:opacity-50"
                        disabled={retryingId === log.id}
                        onClick={() => retryLog(log)}
                        type="button"
                      >
                        {retryingId === log.id ? "Retrying..." : "Retry"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1240px] border-collapse bg-white text-center text-[14px] text-[#001B33]">
            <thead>
              <tr className="table-head-row">
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-semibold text-[#031526]">
                  <FilterHeader filterKey="type" label="Type" />
                </th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-semibold text-[#031526]">Recipient</th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-semibold text-[#031526]">Sent by</th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-semibold text-[#031526]">Message</th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-semibold text-[#031526]">
                  <FilterHeader filterKey="status" label="Status" />
                </th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-semibold text-[#031526]">
                  <FilterHeader filterKey="time" label="Time" />
                </th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-semibold text-[#031526]">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
              ) : filteredLogs.length === 0 ? (
                <tr><td className="px-5 py-12 text-center text-[#86868b]" colSpan={7}>No notification logs found.</td></tr>
              ) : (
                filteredLogs.map((log) => {
                  const displayStatus = deliveryStatus(log);
                  return (
                    <tr key={log.id} className="transition-colors hover:bg-[#F8FBFD]">
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-semibold text-[#1d1d1f]">{humanizeConstant(log.kind)}</td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center">
                        <span className="font-medium text-[#1d1d1f]">{maskPhoneNumber(log.recipientPhone)}</span>
                        {log.student ? <span className="ml-2 text-[11px] text-[#86868b]">{log.student.fullName}</span> : null}
                      </td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-medium text-[#2A3340]">
                        <button
                          className="rounded-md px-2 py-1 font-semibold text-[#2456E6] hover:bg-[#EEF3FF]"
                          onMouseEnter={(event) => showSenderTooltip(event, log)}
                          onMouseLeave={() => setHoveredSender(null)}
                          onMouseMove={(event) => showSenderTooltip(event, log)}
                          type="button"
                        >
                          {senderRole(log)}
                        </button>
                      </td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-[#6e6e73]">
                        <button
                          className="mx-auto block max-w-[380px] truncate text-center hover:text-[#2456E6]"
                          onClick={() => { setHoveredLog(null); setSelectedLog(log); }}
                          onMouseEnter={(event) => showMessageTooltip(event, log.message)}
                          onMouseLeave={() => setHoveredLog(null)}
                          onMouseMove={(event) => showMessageTooltip(event, log.message)}
                          type="button"
                        >
                          {truncateText(log.message, 80)}
                        </button>
                      </td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center"><StatusPill label={displayStatus} tone={statusTone(displayStatus)} /></td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center text-[#6e6e73]">{formatTime(log.sentAt ?? log.createdAt)}</td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="rounded-lg border border-[#F2B8B5] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#D92D20] hover:bg-[#FFF1F0] disabled:opacity-50"
                            disabled={deletingId === log.id}
                            onClick={() => deleteLog(log)}
                            type="button"
                          >
                            {deletingId === log.id ? "Clearing..." : "Clear"}
                          </button>
                          {log.status === "FAILED" ? (
                            <button
                              className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2456E6] hover:bg-[#F7F8FB] disabled:opacity-50"
                              disabled={retryingId === log.id}
                              onClick={() => retryLog(log)}
                              type="button"
                            >
                              {retryingId === log.id ? "Retrying..." : "Retry"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
      </div>

      {selectedLog && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[1px]">
          <button aria-label="Close message" className="absolute inset-0" onClick={() => setSelectedLog(null)} type="button" />
          <div className="relative max-h-[calc(100vh-48px)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-semibold text-[#1d1d1f]">{humanizeConstant(selectedLog.kind)}</h2>
                <p className="mt-1 text-[13px] text-[#86868b]">
                  {maskPhoneNumber(selectedLog.recipientPhone)} | {formatTime(selectedLog.sentAt ?? selectedLog.createdAt)} | Sent by {senderRole(selectedLog)} ({senderName(selectedLog)})
                </p>
              </div>
              <StatusPill label={deliveryStatus(selectedLog)} tone={statusTone(deliveryStatus(selectedLog))} />
            </div>
            <p className="mt-4 whitespace-pre-wrap text-[14px] leading-6 text-[#2A3340]">{selectedLog.message}</p>
            <div className="mt-5 flex justify-end">
              <button className="rounded-lg bg-[#2456E6] px-4 py-2 text-[13px] font-semibold text-white" onClick={() => setSelectedLog(null)} type="button">Close</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
      {filterMenu && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[220]" onClick={() => setFilterMenu(null)}>
          <div
            className="absolute overflow-hidden rounded-xl border border-[#DCE1E8] bg-white py-1 text-left shadow-[0_18px_46px_-18px_rgba(15,20,25,0.45)]"
            onClick={(event) => event.stopPropagation()}
            style={{ left: filterMenu.x, top: filterMenu.y, width: Math.max(filterMenu.width, 190) }}
          >
            <div className="border-b border-[#EEF1F5] px-3 py-2 text-[12px] font-semibold text-[#5A6573]">
              Filter {filterLabels[filterMenu.key]}
            </div>
            {filterOptions(filterMenu.key).map((option) => {
              const active = filterValue(filterMenu.key) === option.value;
              return (
                <button
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] font-semibold ${active ? "bg-[#EEF3FF] text-[#2456E6]" : "text-[#2A3340] hover:bg-[#F7F8FB]"}`}
                  key={`${filterMenu.key}-${option.value}`}
                  onClick={() => applyFilter(filterMenu.key, option.value)}
                  type="button"
                >
                  <span>{option.label}</span>
                  {active ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      ) : null}
      {hoveredLog ? (() => {
        const width = Math.min(520, window.innerWidth - 32);
        const height = Math.min(320, 74 + Math.ceil(hoveredLog.message.length / 48) * 22);
        const left = Math.min(Math.max(16, hoveredLog.x - width / 2), window.innerWidth - width - 16);
        const top = hoveredLog.y + height + 24 > window.innerHeight ? Math.max(16, hoveredLog.y - height - 18) : hoveredLog.y + 18;

        return (
          <div
            className="pointer-events-none fixed z-[230] max-h-[320px] overflow-y-auto rounded-[5px] bg-[#001827] px-4 py-3 text-[14px] font-semibold leading-6 text-white shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
            style={{ left, top, width }}
          >
            <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#001827]" />
            <span className="relative block whitespace-normal">{hoveredLog.message}</span>
          </div>
        );
      })() : null}
      {hoveredSender ? (() => {
        const width = Math.min(320, window.innerWidth - 32);
        const height = 96;
        const left = Math.min(Math.max(16, hoveredSender.x - width / 2), window.innerWidth - width - 16);
        const top = hoveredSender.y + height + 24 > window.innerHeight ? Math.max(16, hoveredSender.y - height - 18) : hoveredSender.y + 18;

        return (
          <div
            className="pointer-events-none fixed z-[235] rounded-[6px] bg-[#001827] px-4 py-3 text-white shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
            style={{ left, top, width }}
          >
            <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#001827]" />
            <span className="relative block text-[12px] font-semibold uppercase tracking-[0.06em] text-white/70">{hoveredSender.role}</span>
            <span className="relative mt-1 block text-[14px] font-semibold">{hoveredSender.name}</span>
          </div>
        );
      })() : null}
    </div>
  );
}
