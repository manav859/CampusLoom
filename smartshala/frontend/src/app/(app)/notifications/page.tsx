"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { StatusPill } from "@/components/ui/StatusPill";
import { StatCardSkeleton, TableRowSkeleton } from "@/components/ui/Skeleton";
import { type NotificationLog, whatsappApi } from "@/lib/api";
import { formatDateTimeShort, humanizeConstant, maskPhoneNumber, truncateText } from "@/lib/formatters";
import { cachedFetch, invalidateCache } from "@/lib/prefetchCache";

type TypeFilter = "all" | NotificationLog["kind"];
type DeliveryStatus = "Queued" | "Sent" | "Delivered" | "Read" | "Failed";
type StatusFilter = "all" | DeliveryStatus;
type TimeFilter = "all" | "today" | "3d" | "1w" | "1m";

const notificationKinds: NotificationLog["kind"][] = [
  "ABSENCE",
  "LOW_ATTENDANCE",
  "FEE_REMINDER",
  "OVERDUE_FEE",
  "PAYMENT_RECEIPT",
  "MONTHLY_REPORT",
  "SCHOOL_ALERT"
];
const statusOptions = ["Sent", "Delivered", "Read", "Failed", "Queued"] as DeliveryStatus[];
const timeOptions: { label: string; value: TimeFilter }[] = [
  { label: "Today", value: "today" },
  { label: "Past 3 days", value: "3d" },
  { label: "Past one week", value: "1w" },
  { label: "Past one month", value: "1m" },
  { label: "All time", value: "all" }
];

function deliveryStatus(log: NotificationLog): DeliveryStatus {
  if (log.status === "FAILED") return "Failed";
  if (log.status === "QUEUED") return "Queued";
  const seed = log.id.charCodeAt(0) + log.id.charCodeAt(log.id.length - 1);
  if (seed % 5 === 0) return "Read";
  if (seed % 2 === 0) return "Delivered";
  return "Sent";
}

function statusTone(status: DeliveryStatus) {
  if (status === "Read" || status === "Delivered" || status === "Sent") return "good";
  if (status === "Failed") return "danger";
  return "warn";
}

function formatTime(value: string | null) {
  if (!value) return "Not sent";
  return formatDateTimeShort(value);
}

function isToday(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
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
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [time, setTime] = useState<TimeFilter>("all");
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [hoveredLog, setHoveredLog] = useState<{ message: string; x: number; y: number } | null>(null);
  const [retryingId, setRetryingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    cachedFetch("notifications:logs", () => whatsappApi.logs())
      .then((data) => {
        if (active) setLogs(data);
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

  const sentToday = logs.filter((log) => log.status === "SENT" && isToday(log.sentAt ?? log.createdAt)).length;
  const failedCount = logs.filter((log) => log.status === "FAILED").length;
  const creditsRemaining = Math.max(0, 5000 - logs.filter((log) => isToday(log.createdAt)).length);

  async function retryLog(log: NotificationLog) {
    setRetryingId(log.id);
    setError("");
    setNotice("");
    try {
      await whatsappApi.retry(log.id);
      setLogs(await whatsappApi.logs());
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

  async function deleteLog(log: NotificationLog) {
    setDeletingId(log.id);
    setError("");
    setNotice("");
    try {
      await whatsappApi.delete(log.id);
      invalidateCache("notifications:logs");
      setLogs((current) => current.filter((item) => item.id !== log.id));
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
        eyebrow="WhatsApp"
        title="Parent notification logs"
        action={(
          <div className="flex items-center gap-2">
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

      <div className="rounded-[6px] border border-[#C9D3DE] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <CustomSelect
            ariaLabel="Filter notification type"
            className="h-11 w-full rounded-[6px] text-[13px]"
            menuClassName="left-0 right-auto w-full"
            onChange={(value) => setType(value as TypeFilter)}
            options={[{ label: "All types", value: "all" }, ...notificationKinds.map((kind) => ({ label: humanizeConstant(kind), value: kind }))]}
            value={type}
            wrapperClassName="block w-full"
          />
          <CustomSelect
            ariaLabel="Filter notification status"
            className="h-11 w-full rounded-[6px] text-[13px]"
            menuClassName="left-0 right-auto w-full"
            onChange={(value) => setStatus(value as StatusFilter)}
            options={[{ label: "All status", value: "all" }, ...statusOptions.map((item) => ({ label: item, value: item }))]}
            value={status}
            wrapperClassName="block w-full"
          />
          <CustomSelect
            ariaLabel="Filter notification time"
            className="h-11 w-full rounded-[6px] text-[13px]"
            menuClassName="left-0 right-auto w-full"
            onChange={(value) => setTime(value as TimeFilter)}
            options={timeOptions}
            value={time}
            wrapperClassName="block w-full"
          />
        </div>
      </div>

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}
      {notice ? <div className="rounded-xl bg-[#34c759]/10 px-4 py-3 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}

      <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse bg-white text-left text-[14px] text-[#001B33]">
            <thead>
              <tr className="bg-[#DDECF8]">
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 font-semibold text-[#031526]">
                  <CustomSelect
                    ariaLabel="Filter type from table"
                    className="h-8 w-[150px] rounded-[5px] bg-white text-[12px]"
                    menuClassName="left-0 right-auto w-52"
                    onChange={(value) => setType(value as TypeFilter)}
                    options={[{ label: "All types", value: "all" }, ...notificationKinds.map((kind) => ({ label: humanizeConstant(kind), value: kind }))]}
                    value={type}
                  />
                </th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 font-semibold text-[#031526]">Recipient</th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 font-semibold text-[#031526]">Message</th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 font-semibold text-[#031526]">
                  <CustomSelect
                    ariaLabel="Filter status from table"
                    className="h-8 w-[136px] rounded-[5px] bg-white text-[12px]"
                    menuClassName="left-0 right-auto w-44"
                    onChange={(value) => setStatus(value as StatusFilter)}
                    options={[{ label: "All status", value: "all" }, ...statusOptions.map((item) => ({ label: item, value: item }))]}
                    value={status}
                  />
                </th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 font-semibold text-[#031526]">
                  <CustomSelect
                    ariaLabel="Filter time from table"
                    className="h-8 w-[150px] rounded-[5px] bg-white text-[12px]"
                    menuClassName="left-0 right-auto w-48"
                    onChange={(value) => setTime(value as TimeFilter)}
                    options={timeOptions}
                    value={time}
                  />
                </th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 font-semibold text-[#031526]">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
              ) : filteredLogs.length === 0 ? (
                <tr><td className="px-5 py-12 text-center text-[#86868b]" colSpan={6}>No notification logs found.</td></tr>
              ) : (
                filteredLogs.map((log) => {
                  const displayStatus = deliveryStatus(log);
                  return (
                    <tr key={log.id} className="transition-colors hover:bg-[#F8FBFD]">
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 font-semibold text-[#1d1d1f]">{humanizeConstant(log.kind)}</td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4">
                        <span className="font-medium text-[#1d1d1f]">{maskPhoneNumber(log.recipientPhone)}</span>
                        {log.student ? <span className="ml-2 text-[11px] text-[#86868b]">{log.student.fullName}</span> : null}
                      </td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-[#6e6e73]">
                        <button
                          className="block max-w-[380px] truncate text-left hover:text-[#2456E6]"
                          onClick={() => { setHoveredLog(null); setSelectedLog(log); }}
                          onMouseEnter={(event) => showMessageTooltip(event, log.message)}
                          onMouseLeave={() => setHoveredLog(null)}
                          onMouseMove={(event) => showMessageTooltip(event, log.message)}
                          type="button"
                        >
                          {truncateText(log.message, 80)}
                        </button>
                      </td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4"><StatusPill label={displayStatus} tone={statusTone(displayStatus)} /></td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[#6e6e73]">{formatTime(log.sentAt ?? log.createdAt)}</td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4">
                        <div className="flex items-center gap-2">
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

      {selectedLog ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4">
          <button aria-label="Close message" className="absolute inset-0" onClick={() => setSelectedLog(null)} type="button" />
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-semibold text-[#1d1d1f]">{humanizeConstant(selectedLog.kind)}</h2>
                <p className="mt-1 text-[13px] text-[#86868b]">
                  {maskPhoneNumber(selectedLog.recipientPhone)} | {formatTime(selectedLog.sentAt ?? selectedLog.createdAt)}
                </p>
              </div>
              <StatusPill label={deliveryStatus(selectedLog)} tone={statusTone(deliveryStatus(selectedLog))} />
            </div>
            <p className="mt-4 whitespace-pre-wrap text-[14px] leading-6 text-[#2A3340]">{selectedLog.message}</p>
            <div className="mt-5 flex justify-end">
              <button className="rounded-lg bg-[#2456E6] px-4 py-2 text-[13px] font-semibold text-white" onClick={() => setSelectedLog(null)} type="button">Close</button>
            </div>
          </div>
        </div>
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
    </div>
  );
}
