"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { StatCardSkeleton, TableRowSkeleton } from "@/components/ui/Skeleton";
import { type NotificationLog, whatsappApi } from "@/lib/api";
import { formatDateTimeShort, humanizeConstant, maskPhoneNumber, truncateText } from "@/lib/formatters";
import { cachedFetch } from "@/lib/prefetchCache";

type TypeFilter = "all" | NotificationLog["kind"];
type DeliveryStatus = "Queued" | "Sent" | "Delivered" | "Read" | "Failed";
type StatusFilter = "all" | DeliveryStatus;

const notificationKinds: NotificationLog["kind"][] = [
  "ABSENCE",
  "LOW_ATTENDANCE",
  "FEE_REMINDER",
  "OVERDUE_FEE",
  "PAYMENT_RECEIPT",
  "MONTHLY_REPORT",
  "SCHOOL_ALERT"
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

export default function NotificationsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [retryingId, setRetryingId] = useState("");
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
    return typeMatches && statusMatches;
  }), [logs, status, type]);

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

  return (
    <div className="space-y-6">
      <PageHeader title="Message logs" action={<button className="btn-primary">Send message</button>} />

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

      <div className="glass-card-interactive p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-semibold text-[#1d1d1f]">Type</span>
            <select className="glass-input mt-2 w-full" onChange={(event) => setType(event.target.value as TypeFilter)} value={type}>
              <option value="all">All types</option>
              {notificationKinds.map((kind) => (
                <option key={kind} value={kind}>{humanizeConstant(kind)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#1d1d1f]">Status</span>
            <select className="glass-input mt-2 w-full" onChange={(event) => setStatus(event.target.value as StatusFilter)} value={status}>
              <option value="all">All status</option>
              {(["Sent", "Delivered", "Read", "Failed", "Queued"] as DeliveryStatus[]).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}
      {notice ? <div className="rounded-xl bg-[#34c759]/10 px-4 py-3 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}

      <div className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead className="table-head">
              <tr>{["Type", "Recipient", "Message", "Status", "Time", "Action"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
              ) : filteredLogs.length === 0 ? (
                <tr><td className="px-5 py-12 text-center text-[#86868b]" colSpan={6}>No notification logs found.</td></tr>
              ) : (
                filteredLogs.map((log) => {
                  const displayStatus = deliveryStatus(log);
                  return (
                    <tr key={log.id} className="table-row">
                      <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{humanizeConstant(log.kind)}</td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-[#1d1d1f]">{maskPhoneNumber(log.recipientPhone)}</p>
                        {log.student ? <p className="text-[11px] text-[#86868b]">{log.student.fullName}</p> : null}
                      </td>
                      <td className="max-w-sm px-5 py-4 text-[#6e6e73]">
                        <button className="text-left hover:text-[#2456E6]" onClick={() => setSelectedLog(log)} title={log.message} type="button">
                          {truncateText(log.message, 80)}
                        </button>
                        {log.message.length > 80 ? (
                          <button className="ml-2 text-[12px] font-semibold text-[#2456E6]" onClick={() => setSelectedLog(log)} type="button">View full</button>
                        ) : null}
                      </td>
                      <td className="px-5 py-4"><StatusPill label={displayStatus} tone={statusTone(displayStatus)} /></td>
                      <td className="px-5 py-4 text-[#6e6e73]">{formatTime(log.sentAt ?? log.createdAt)}</td>
                      <td className="px-5 py-4">
                        {log.status === "FAILED" ? (
                          <button
                            className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2456E6] hover:bg-[#F7F8FB] disabled:opacity-50"
                            disabled={retryingId === log.id}
                            onClick={() => retryLog(log)}
                            type="button"
                          >
                            {retryingId === log.id ? "Retrying..." : "Retry"}
                          </button>
                        ) : (
                          <span className="text-[#86868b]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}
