import { StatusPill } from "@/components/ui/StatusPill";
import type { StudentDetail } from "@/lib/api";

export type CommunicationTabPanelProps = {
  student: StudentDetail;
};

type CommunicationEntry = StudentDetail["communicationAudit"][number];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

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

export default function CommunicationTabPanel({ student }: CommunicationTabPanelProps) {
  const logs = student.communicationAudit;
  const whatsappCount = logs.filter((log) => log.type === "WHATSAPP").length;
  const noteCount = logs.filter((log) => log.type === "MANUAL_NOTE").length;
  const callCount = logs.filter((log) => log.type === "CALL").length;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-4 shadow-apple-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">WhatsApp logs</p>
          <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-[#248a3d]">{whatsappCount}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-4 shadow-apple-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Manual notes</p>
          <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{noteCount}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-4 shadow-apple-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Call logs</p>
          <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-[#0071e3]">{callCount}</p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
          <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Communication audit trail</h2>
            <p className="mt-0.5 text-[13px] text-[#86868b]">Latest parent communication appears first.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="table-head">
                <tr>
                  {["Timestamp", "Type", "Channel", "Summary", "Status"].map((head) => (
                    <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {logs.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-[#86868b]" colSpan={5}>No communication records found.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr className="table-row" key={`${log.source}-${log.id}`}>
                      <td className="px-5 py-4 text-[#6e6e73]">{formatDateTime(log.timestamp)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${typeBadgeClasses(log.type)}`}>{typeLabel(log.type)}</span>
                      </td>
                      <td className="px-5 py-4 text-[#6e6e73]">{channelLabel(log.channel)}</td>
                      <td className="max-w-[360px] px-5 py-4 font-medium text-[#1d1d1f]">{log.summary}</td>
                      <td className="px-5 py-4"><StatusPill label={log.status} tone={statusTone(log.status)} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Timeline</h2>
          <div className="mt-5 space-y-5">
            {logs.length === 0 ? (
              <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4 text-[13px] font-medium text-[#86868b]">No communication timeline yet.</div>
            ) : (
              logs.slice(0, 12).map((log, index) => (
                <div className="relative pl-7" key={`${log.source}-timeline-${log.id}`}>
                  <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-[#0071e3] ring-4 ring-[#0071e3]/15" />
                  {index < Math.min(logs.length, 12) - 1 ? <span className="absolute bottom-[-22px] left-[5px] top-5 w-px bg-[rgba(0,0,0,0.08)]" /> : null}
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">{typeLabel(log.type)} - {channelLabel(log.channel)}</p>
                  <p className="mt-1 text-[12px] text-[#86868b]">{formatDateTime(log.timestamp)}</p>
                  <p className="mt-1 text-[12px] font-medium leading-5 text-[#6e6e73]">{log.summary}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </section>
  );
}
