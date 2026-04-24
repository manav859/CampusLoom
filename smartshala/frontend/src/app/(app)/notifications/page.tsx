"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { StatCardSkeleton, TableRowSkeleton } from "@/components/ui/Skeleton";
import { type NotificationLog, whatsappApi } from "@/lib/api";

type TypeFilter = "all" | "attendance" | "fees" | "report";
type StatusFilter = "all" | NotificationLog["status"];

function notificationType(kind: NotificationLog["kind"]): TypeFilter {
  if (kind === "ABSENCE" || kind === "LOW_ATTENDANCE") return "attendance";
  if (kind === "FEE_REMINDER" || kind === "OVERDUE_FEE" || kind === "PAYMENT_RECEIPT") return "fees";
  if (kind === "MONTHLY_REPORT") return "report";
  return "all";
}

function statusTone(status: NotificationLog["status"]) {
  if (status === "SENT") return "good";
  if (status === "FAILED") return "danger";
  return "warn";
}

function statusLabel(status: NotificationLog["status"]) {
  if (status === "SENT") return "Sent";
  if (status === "FAILED") return "Failed";
  return "Queued";
}

function formatTime(value: string | null) {
  if (!value) return "Not sent";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    whatsappApi.logs()
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
    const typeMatches = type === "all" || notificationType(log.kind) === type;
    const statusMatches = status === "all" || log.status === status;
    return typeMatches && statusMatches;
  }), [logs, status, type]);

  const sentToday = logs.filter((log) => log.status === "SENT" && isToday(log.sentAt ?? log.createdAt)).length;
  const failedCount = logs.filter((log) => log.status === "FAILED").length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="WhatsApp" title="Parent notification logs" action={<button className="btn-primary">Send message</button>} />

      <section className="grid gap-4 sm:grid-cols-2">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <div className="glass-card-interactive p-6">
              <p className="text-[13px] font-semibold text-[#248a3d]">Total sent today</p>
              <p className="mt-3 text-[40px] font-semibold tracking-tight text-[#1d1d1f]">{sentToday}</p>
            </div>
            <div className="glass-card-interactive p-6">
              <p className="text-[13px] font-semibold text-[#d70015]">Failed count</p>
              <p className="mt-3 text-[40px] font-semibold tracking-tight text-[#1d1d1f]">{failedCount}</p>
            </div>
          </>
        )}
      </section>

      <div className="glass-card-interactive p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-semibold text-[#1d1d1f]">Type</span>
            <select className="glass-input mt-2" onChange={(event) => setType(event.target.value as TypeFilter)} value={type}>
              <option value="all">All types</option>
              <option value="attendance">Attendance</option>
              <option value="fees">Fees</option>
              <option value="report">Report</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#1d1d1f]">Status</span>
            <select className="glass-input mt-2" onChange={(event) => setStatus(event.target.value as StatusFilter)} value={status}>
              <option value="all">All status</option>
              <option value="SENT">Sent</option>
              <option value="QUEUED">Queued</option>
              <option value="FAILED">Failed</option>
            </select>
          </label>
        </div>
      </div>

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="table-head">
              <tr>{["Type", "Recipient", "Message", "Status", "Time"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
              ) : filteredLogs.length === 0 ? (
                <tr><td className="px-5 py-12 text-center text-[#86868b]" colSpan={5}>No notification logs found.</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="table-row">
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{log.kind.replaceAll("_", " ")}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-[#1d1d1f]">{log.recipientPhone}</p>
                      {log.student ? <p className="text-[11px] text-[#86868b]">{log.student.fullName}</p> : null}
                    </td>
                    <td className="max-w-sm truncate px-5 py-4 text-[#6e6e73]">{log.message}</td>
                    <td className="px-5 py-4"><StatusPill label={statusLabel(log.status)} tone={statusTone(log.status)} /></td>
                    <td className="px-5 py-4 text-[#6e6e73]">{formatTime(log.sentAt ?? log.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
