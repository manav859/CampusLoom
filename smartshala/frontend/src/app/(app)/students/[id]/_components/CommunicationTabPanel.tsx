"use client";

import { useMemo, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { truncateText } from "@/lib/formatters";
import { communicationApi, type StudentDetail } from "@/lib/api";
import { formatDateTimeShort } from "@/lib/formatters";

export type CommunicationTabPanelProps = {
  student: StudentDetail;
};

type CommunicationEntry = StudentDetail["communicationAudit"][number];
type ChannelFilter = "ALL" | "WHATSAPP" | "CALL" | "MANUAL";

function typeLabel(type: CommunicationEntry["type"]) {
  if (type === "WHATSAPP") return "WhatsApp";
  if (type === "MANUAL_NOTE") return "Manual note";
  return "Call";
}

function channelLabel(channel: CommunicationEntry["channel"]) {
  if (channel === "IN_PERSON") return "In person";
  return channel.charAt(0) + channel.slice(1).toLowerCase();
}

function statusTone(status: CommunicationEntry["status"]) {
  if (status === "SENT" || status === "COMPLETED" || status === "NOTE") return "good";
  if (status === "QUEUED") return "warn";
  return "danger";
}

function typeBadgeClasses(type: CommunicationEntry["type"]) {
  if (type === "WHATSAPP") return "bg-[#34c759]/15 text-[#248a3d]";
  if (type === "CALL") return "bg-[#0071e3]/12 text-[#0071e3]";
  return "bg-[rgba(0,0,0,0.05)] text-[#6e6e73]";
}

function matchesFilter(log: CommunicationEntry, filter: ChannelFilter) {
  if (filter === "ALL") return true;
  if (filter === "MANUAL") return log.type === "MANUAL_NOTE";
  return log.type === filter;
}

const filters: { key: ChannelFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "WHATSAPP", label: "WhatsApp" },
  { key: "CALL", label: "Call" },
  { key: "MANUAL", label: "Manual" }
];

export default function CommunicationTabPanel({ student }: CommunicationTabPanelProps) {
  const logs = student.communicationAudit;
  const whatsappCount = logs.filter((log) => log.type === "WHATSAPP").length;
  const noteCount = logs.filter((log) => log.type === "MANUAL_NOTE").length;
  const callCount = logs.filter((log) => log.type === "CALL").length;
  const [filter, setFilter] = useState<ChannelFilter>("ALL");
  const [selectedLog, setSelectedLog] = useState<CommunicationEntry | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const filteredLogs = useMemo(() => logs.filter((log) => matchesFilter(log, filter)), [filter, logs]);

  async function retryMessage(log: CommunicationEntry) {
    if (!log.recipientPhone) {
      setError("Parent phone is missing for this message.");
      return;
    }

    setRetryingId(log.id);
    setError("");
    setNotice("");
    try {
      await communicationApi.sendMessage({
        targetType: "STUDENT",
        studentId: student.id,
        type: "CUSTOM",
        message: log.summary
      });
      setNotice(`Retry sent to ${log.recipientPhone}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry WhatsApp message");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <section className="space-y-4">
      {notice ? <div className="rounded-[6px] border border-[#0F8A4A]/20 bg-[#E1F5EA] px-4 py-3 text-[13px] font-medium text-[#128C7E]">{notice}</div> : null}
      {error ? <div className="rounded-[6px] border border-[#FCE3E5] bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="kpi-metric-card kpi-metric-card-good p-4">
          <p className="kpi-metric-label">WhatsApp Logs</p>
          <p className="kpi-metric-value">{whatsappCount}</p>
          {whatsappCount === 0 ? <a className="mt-2 inline-flex text-[12px] font-semibold text-[#2456E6]" href="/teacher/communication">Send WhatsApp</a> : null}
        </div>
        <div className="kpi-metric-card p-4">
          <p className="kpi-metric-label">Manual Notes</p>
          <p className="kpi-metric-value">{noteCount}</p>
          {noteCount === 0 ? <a className="mt-2 inline-flex text-[12px] font-semibold text-[#2456E6]" href="/teacher/communication">Add Manual Note</a> : null}
        </div>
        <div className="kpi-metric-card p-4">
          <p className="kpi-metric-label">Call Logs</p>
          <p className="kpi-metric-value">{callCount}</p>
          {callCount === 0 ? <a className="mt-2 inline-flex text-[12px] font-semibold text-[#2456E6]" href="/teacher/communication">Log a Call</a> : null}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
          <div className="flex flex-col gap-4 border-b border-[#E7EBF0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Communication Audit Trail</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">Latest parent communication appears first.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  className={`rounded-[6px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    filter === item.key ? "bg-[#2456E6] text-white" : "bg-[#F7F8FB] text-[#5A6573] hover:bg-[#E2F0FB]"
                  }`}
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {filteredLogs.length === 0 ? (
              <div className="rounded-[6px] bg-[#F7F8FB] p-4 text-[13px] font-medium text-[#86868b]">No communication records for this filter.</div>
            ) : (
              filteredLogs.map((log) => (
                <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_8px_22px_-18px_rgba(15,20,25,0.35)]" key={`mobile-log-${log.source}-${log.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`inline-flex rounded-[6px] px-2.5 py-1 text-[11px] font-semibold ${typeBadgeClasses(log.type)}`}>{typeLabel(log.type)}</span>
                      <p className="mt-2 text-[12px] font-medium text-[#5A6573]">{formatDateTimeShort(log.timestamp)} - {channelLabel(log.channel)}</p>
                    </div>
                    <StatusPill label={log.status} tone={statusTone(log.status)} />
                  </div>
                  <button className="mt-3 block text-left text-[13px] font-medium leading-5 text-[#0F1419]" onClick={() => setSelectedLog(log)} type="button">
                    {truncateText(log.summary, 140)}
                  </button>
                  {log.type === "WHATSAPP" && log.status === "FAILED" ? (
                    <button className="mt-3 rounded-[6px] bg-[#25D366]/10 px-3 py-2 text-[12px] font-bold text-[#128C7E] hover:bg-[#25D366] hover:text-white disabled:opacity-50" disabled={retryingId === log.id} onClick={() => retryMessage(log)} type="button">
                      {retryingId === log.id ? "Retrying..." : "Retry"}
                    </button>
                  ) : null}
                </article>
              ))
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[960px] border-collapse bg-white text-center text-[14px] text-[#001B33]">
              <thead>
                <tr className="table-head-row">
                  {["Timestamp", "Type", "Channel", "Summary", "Status", "Actions"].map((head) => (
                    <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center text-[14px] font-semibold text-[#031526]" key={head}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-[#86868b]" colSpan={6}>No communication records for this filter.</td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr className="transition-colors duration-200 hover:bg-[#F8FBFD]" key={`${log.source}-${log.id}`}>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{formatDateTimeShort(log.timestamp)}</td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                        <span className={`inline-flex rounded-[6px] px-2.5 py-1 text-[11px] font-semibold ${typeBadgeClasses(log.type)}`}>{typeLabel(log.type)}</span>
                      </td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{channelLabel(log.channel)}</td>
                      <td className="max-w-[360px] border-b border-[#C9D3DE] px-4 py-4 text-center font-medium text-[#1d1d1f]">
                        <button className="text-left hover:text-[#2456E6]" onClick={() => setSelectedLog(log)} type="button">
                          {truncateText(log.summary, 96)}
                        </button>
                      </td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-center"><StatusPill label={log.status} tone={statusTone(log.status)} /></td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                        <div className="flex flex-wrap gap-2">
                          <button className="rounded-lg bg-[#F7F8FB] px-3 py-1.5 text-[11px] font-bold text-[#2456E6] hover:bg-[#E2F0FB]" onClick={() => setSelectedLog(log)} type="button">
                            View Full
                          </button>
                          {log.type === "WHATSAPP" && log.status === "FAILED" ? (
                            <button
                              className="rounded-lg bg-[#25D366]/10 px-3 py-1.5 text-[11px] font-bold text-[#128C7E] hover:bg-[#25D366] hover:text-white disabled:opacity-50"
                              disabled={retryingId === log.id}
                              onClick={() => retryMessage(log)}
                              type="button"
                            >
                              {retryingId === log.id ? "Retrying..." : "Retry"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Timeline</h2>
          <div className="mt-5 space-y-5">
            {filteredLogs.length === 0 ? (
              <div className="rounded-[6px] bg-[#F7F8FB] p-4 text-[13px] font-medium text-[#86868b]">No communication timeline yet.</div>
            ) : (
              filteredLogs.slice(0, 12).map((log, index) => (
                <div className="relative pl-7" key={`${log.source}-timeline-${log.id}`}>
                  <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-[#0071e3] ring-4 ring-[#0071e3]/15" />
                  {index < Math.min(filteredLogs.length, 12) - 1 ? <span className="absolute bottom-[-22px] left-[5px] top-5 w-px bg-[rgba(0,0,0,0.08)]" /> : null}
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">{typeLabel(log.type)} - {channelLabel(log.channel)}</p>
                  <p className="mt-1 text-[12px] text-[#86868b]">{formatDateTimeShort(log.timestamp)}</p>
                  <p className="mt-1 text-[12px] font-medium leading-5 text-[#6e6e73]">{truncateText(log.summary, 120)}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>

      {selectedLog ? (
        <div className="fixed inset-0 z-[200] flex items-end bg-black/40 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-xl rounded-[6px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">{typeLabel(selectedLog.type)} - {channelLabel(selectedLog.channel)}</p>
                <h2 className="mt-1 text-[19px] font-semibold text-[#1d1d1f]">{formatDateTimeShort(selectedLog.timestamp)}</h2>
              </div>
              <button className="rounded-full bg-[#F7F8FB] px-3 py-1.5 text-[12px] font-bold text-[#5A6573]" onClick={() => setSelectedLog(null)} type="button">
                Close
              </button>
            </div>
            <div className="mt-5 rounded-[6px] bg-[#F7F8FB] p-4 text-[14px] leading-6 text-[#1d1d1f]">
              {selectedLog.summary}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <StatusPill label={selectedLog.status} tone={statusTone(selectedLog.status)} />
              {selectedLog.type === "WHATSAPP" && selectedLog.status === "FAILED" ? (
                <button
                  className="rounded-lg bg-[#25D366]/10 px-4 py-2 text-[12px] font-bold text-[#128C7E] hover:bg-[#25D366] hover:text-white disabled:opacity-50"
                  disabled={retryingId === selectedLog.id}
                  onClick={() => retryMessage(selectedLog)}
                  type="button"
                >
                  {retryingId === selectedLog.id ? "Retrying..." : "Retry WhatsApp"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
