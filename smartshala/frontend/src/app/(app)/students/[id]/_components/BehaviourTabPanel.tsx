import { StatusPill } from "@/components/ui/StatusPill";
import type { StudentDetail } from "@/lib/api";

export type BehaviourTabPanelProps = {
  student: StudentDetail;
};

type BehaviourRecord = StudentDetail["behaviourAnalytics"]["records"][number];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function typeLabel(type: BehaviourRecord["type"]) {
  if (type === "ACHIEVEMENT") return "Achievement";
  if (type === "COUNSELLOR_NOTE") return "Counsellor note";
  return "Incident";
}

function severityTone(record: BehaviourRecord) {
  if (record.type === "ACHIEVEMENT" || record.severity === "POSITIVE") return "good";
  if (record.severity === "HIGH") return "danger";
  if (record.severity === "MEDIUM" || record.type === "COUNSELLOR_NOTE") return "warn";
  return "neutral";
}

function typeBadgeClasses(type: BehaviourRecord["type"]) {
  if (type === "ACHIEVEMENT") return "bg-[#34c759]/15 text-[#248a3d]";
  if (type === "COUNSELLOR_NOTE") return "bg-[#5856d6]/12 text-[#5856d6]";
  return "bg-[#ff9500]/12 text-[#c93400]";
}

function emptyMessage(canViewCounsellorNotes: boolean) {
  return canViewCounsellorNotes
    ? "No incidents, achievements, or counsellor notes have been recorded yet."
    : "No visible incidents or achievements have been recorded yet.";
}

export default function BehaviourTabPanel({ student }: BehaviourTabPanelProps) {
  const behaviour = student.behaviourAnalytics;
  const records = behaviour.records;
  const recentIncidents = records.filter((record) => record.type === "INCIDENT").slice(0, 3);
  const recentAchievements = records.filter((record) => record.type === "ACHIEVEMENT").slice(0, 3);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white/90 p-4 shadow-apple-sm backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Incidents</p>
          <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-[#c93400]">{behaviour.counts.incidents}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white/90 p-4 shadow-apple-sm backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Positive achievements</p>
          <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-[#248a3d]">{behaviour.counts.achievements}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white/90 p-4 shadow-apple-sm backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Counsellor notes</p>
          <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-[#5856d6]">{behaviour.counts.counsellorNotes}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white/90 p-4 shadow-apple-sm backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Total records</p>
          <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{behaviour.counts.total}</p>
        </div>
      </div>

      {!behaviour.canViewCounsellorNotes ? (
        <div className="rounded-2xl border border-[#5856d6]/15 bg-[#5856d6]/[0.06] p-4 text-[13px] font-medium leading-6 text-[#5856d6]">
          Counsellor notes are restricted to Principal and Admin roles. Teacher view only includes incidents and positive achievements.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white/90 p-5 shadow-apple backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Recent incidents</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">Action-focused behaviour signals.</p>
            </div>
            <StatusPill label={`${behaviour.counts.incidents} total`} tone={behaviour.counts.incidents > 0 ? "warn" : "good"} />
          </div>
          <div className="mt-5 space-y-3">
            {recentIncidents.length === 0 ? (
              <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4 text-[13px] font-medium text-[#86868b]">No recent incidents.</div>
            ) : (
              recentIncidents.map((record) => (
                <div className="rounded-xl border border-[rgba(0,0,0,0.05)] p-4" key={`incident-${record.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">{record.title}</p>
                    <StatusPill label={record.severity} tone={severityTone(record)} />
                  </div>
                  <p className="mt-1 text-[12px] font-medium text-[#86868b]">{formatDate(record.occurredAt)}</p>
                  <p className="mt-2 text-[13px] leading-5 text-[#6e6e73]">{record.summary}</p>
                  {record.actionTaken ? <p className="mt-2 text-[12px] font-semibold text-[#1d1d1f]">Action: {record.actionTaken}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white/90 p-5 shadow-apple backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Positive achievements</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">Strengths and growth moments.</p>
            </div>
            <StatusPill label={`${behaviour.counts.achievements} total`} tone="good" />
          </div>
          <div className="mt-5 space-y-3">
            {recentAchievements.length === 0 ? (
              <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4 text-[13px] font-medium text-[#86868b]">No positive achievements yet.</div>
            ) : (
              recentAchievements.map((record) => (
                <div className="rounded-xl border border-[#34c759]/15 bg-[#34c759]/[0.04] p-4" key={`achievement-${record.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">{record.title}</p>
                    <StatusPill label={record.severity} tone="good" />
                  </div>
                  <p className="mt-1 text-[12px] font-medium text-[#86868b]">{formatDate(record.occurredAt)}</p>
                  <p className="mt-2 text-[13px] leading-5 text-[#6e6e73]">{record.summary}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white/90 shadow-apple backdrop-blur-xl">
        <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Behaviour record</h2>
          <p className="mt-0.5 text-[13px] text-[#86868b]">Latest entries first, with restricted notes protected by role.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-[13px]">
            <thead className="table-head">
              <tr>
                {["Date", "Type", "Severity", "Details", "Action", "Logged by"].map((head) => (
                  <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {records.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-[#86868b]" colSpan={6}>{emptyMessage(behaviour.canViewCounsellorNotes)}</td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr className="table-row" key={record.id}>
                    <td className="px-5 py-4 text-[#6e6e73]">{formatDate(record.occurredAt)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${typeBadgeClasses(record.type)}`}>{typeLabel(record.type)}</span>
                    </td>
                    <td className="px-5 py-4"><StatusPill label={record.severity} tone={severityTone(record)} /></td>
                    <td className="max-w-[360px] px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#1d1d1f]">{record.title}</p>
                        {record.isRestricted ? <StatusPill label="Restricted" tone="warn" /> : null}
                      </div>
                      <p className="mt-1 text-[12px] leading-5 text-[#6e6e73]">{record.summary}</p>
                    </td>
                    <td className="px-5 py-4 text-[#6e6e73]">{record.actionTaken ?? "Not recorded"}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{record.createdBy?.fullName ?? "System"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
