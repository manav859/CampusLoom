import { useEffect, useState, type FormEvent } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { studentsApi, whatsappApi, type BehaviourRecordPayload, type StudentDetail } from "@/lib/api";
import { formatDateShort } from "@/lib/formatters";
import { invalidateCache } from "@/lib/prefetchCache";

export type BehaviourTabPanelProps = {
  student: StudentDetail;
};

type BehaviourRecord = StudentDetail["behaviourAnalytics"]["records"][number];

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

function severityLabel(severity: BehaviourRecord["severity"]) {
  if (severity === "LOW") return "Minor";
  if (severity === "MEDIUM") return "Major";
  if (severity === "HIGH") return "Critical";
  if (severity === "POSITIVE") return "Positive";
  return "Note";
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

function defaultSeverity(type: BehaviourRecordPayload["type"]): BehaviourRecordPayload["severity"] {
  if (type === "ACHIEVEMENT") return "POSITIVE";
  return "LOW";
}

function countBehaviour(records: BehaviourRecord[]) {
  return {
    incidents: records.filter((record) => record.type === "INCIDENT").length,
    achievements: records.filter((record) => record.type === "ACHIEVEMENT").length,
    counsellorNotes: records.filter((record) => record.type === "COUNSELLOR_NOTE").length,
    total: records.length
  };
}

export default function BehaviourTabPanel({ student }: BehaviourTabPanelProps) {
  const [behaviour, setBehaviour] = useState(student.behaviourAnalytics);
  const [form, setForm] = useState<BehaviourRecordPayload>({
    type: "INCIDENT",
    severity: "LOW",
    title: "",
    summary: ""
  });
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [selectedIncident, setSelectedIncident] = useState<BehaviourRecord | null>(null);
  const [actionText, setActionText] = useState("");
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [notifyError, setNotifyError] = useState("");
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const role = student.access?.role;
  const canWriteBehaviour = role === "TEACHER";
  const canTakeAction = role === "PRINCIPAL" || role === "ADMIN";
  const records = behaviour.records;
  const recentIncidents = records.filter((record) => record.type === "INCIDENT").slice(0, 3);
  const recentAchievements = records.filter((record) => record.type === "ACHIEVEMENT").slice(0, 3);

  useEffect(() => {
    setBehaviour(student.behaviourAnalytics);
  }, [student.behaviourAnalytics]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setFormMessage("");

    const title = form.title.trim();
    const summary = form.summary.trim();
    if (!title || !summary) {
      setFormError("Title and details are required.");
      return;
    }

    setSaving(true);
    try {
      const created = await studentsApi.createBehaviourRecord(student.id, {
        ...form,
        title,
        summary,
        severity: form.severity ?? defaultSeverity(form.type),
        actionTaken: undefined,
        isRestricted: false
      });
      setBehaviour((current) => {
        const nextRecords = [created, ...current.records];
        return {
          ...current,
          counts: countBehaviour(nextRecords),
          records: nextRecords
        };
      });
      invalidateCache(`student:${student.id}`);
      invalidateCache("dashboard");
      setForm({
        type: "INCIDENT",
        severity: "LOW",
        title: "",
        summary: ""
      });
      setFormMessage("Behaviour record saved.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save behaviour record");
    } finally {
      setSaving(false);
    }
  }

  function openActionModal(record: BehaviourRecord) {
    setSelectedIncident(record);
    setActionText(record.actionTaken ?? "");
    setActionError("");
  }

  async function notifyParent(record: BehaviourRecord) {
    setNotifyingId(record.id);
    setNotice("");
    setNotifyError("");
    try {
      await whatsappApi.send({
        phone: student.parentPhone,
        message: `SmartShala update for ${student.fullName}: ${typeLabel(record.type)} - ${record.title}. ${record.summary}`
      });
      setNotice(`Parent notified on WhatsApp for "${record.title}".`);
    } catch (error) {
      setNotifyError(error instanceof Error ? error.message : "Unable to notify parent on WhatsApp");
    } finally {
      setNotifyingId(null);
    }
  }

  async function handleActionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedIncident) return;

    const actionTaken = actionText.trim();
    if (!actionTaken) {
      setActionError("Action taken is required.");
      return;
    }

    setActionSaving(true);
    setActionError("");
    try {
      const updated = await studentsApi.updateBehaviourAction(student.id, selectedIncident.id, { actionTaken });
      setBehaviour((current) => ({
        ...current,
        records: current.records.map((record) => (record.id === updated.id ? updated : record))
      }));
      invalidateCache(`student:${student.id}`);
      invalidateCache("dashboard");
      setSelectedIncident(null);
      setActionText("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to save action");
    } finally {
      setActionSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      {notice ? <div className="rounded-xl bg-[#25D366]/10 px-4 py-3 text-[13px] font-medium text-[#128C7E]">{notice}</div> : null}
      {notifyError ? <div className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{notifyError}</div> : null}

      {canWriteBehaviour ? (
        <form className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white/90 p-5 shadow-apple-sm backdrop-blur-xl" id="behaviour-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Add behaviour record</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">Teacher entries appear in the principal behaviour view.</p>
            </div>
            {formMessage ? <span className="text-[12px] font-semibold text-[#248a3d]">{formMessage}</span> : null}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[150px_150px_1fr]">
            <label className="space-y-1.5">
              <span className="text-[12px] font-semibold text-[#6e6e73]">Type</span>
              <select
                className="glass-input min-h-[44px] text-[14px]"
                value={form.type}
                onChange={(event) => {
                  const type = event.target.value as BehaviourRecordPayload["type"];
                  setForm((current) => ({ ...current, type, severity: defaultSeverity(type), isRestricted: false }));
                }}
              >
                <option value="INCIDENT">Incident</option>
                <option value="ACHIEVEMENT">Achievement</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[12px] font-semibold text-[#6e6e73]">Rating</span>
              <select
                className="glass-input min-h-[44px] text-[14px]"
                value={form.severity ?? defaultSeverity(form.type)}
                onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as BehaviourRecordPayload["severity"] }))}
              >
                {form.type === "ACHIEVEMENT" ? <option value="POSITIVE">Positive</option> : null}
                {form.type === "INCIDENT" ? (
                  <>
                    <option value="LOW">Minor</option>
                    <option value="MEDIUM">Major</option>
                    <option value="HIGH">Critical</option>
                  </>
                ) : null}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[12px] font-semibold text-[#6e6e73]">Title</span>
              <input
                className="glass-input min-h-[44px] text-[14px]"
                maxLength={160}
                placeholder="Short behaviour title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
          </div>

          <div className="mt-3">
            <label className="space-y-1.5">
              <span className="text-[12px] font-semibold text-[#6e6e73]">Details</span>
              <textarea
                className="glass-input min-h-[96px] resize-none text-[14px] leading-6"
                maxLength={2000}
                placeholder="What happened?"
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
              />
            </label>
          </div>

          {formError ? <p className="mt-3 rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{formError}</p> : null}

          <div className="mt-4 flex justify-end">
            <button className="btn-primary min-h-[44px] px-5 text-[14px]" disabled={saving} type="submit">
              {saving ? "Saving..." : "Save behaviour record"}
            </button>
          </div>
        </form>
      ) : null}

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

      {records.length === 0 ? (
        <EmptyState
          headline="No behaviour records"
          description={emptyMessage(behaviour.canViewCounsellorNotes)}
          action={
            canWriteBehaviour ? (
              <a className="btn-primary min-h-[42px] px-4 text-[13px]" href="#behaviour-form">
                Log behaviour entry
              </a>
            ) : null
          }
        />
      ) : (
      <>
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
              <div className="py-2"><EmptyState headline="No incidents" description="No recent incidents recorded." /></div>
            ) : (
              recentIncidents.map((record) => (
                <div className="rounded-xl border border-[rgba(0,0,0,0.05)] p-4" key={`incident-${record.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">{record.title}</p>
                    <StatusPill label={severityLabel(record.severity)} tone={severityTone(record)} />
                  </div>
                  <p className="mt-1 text-[12px] font-medium text-[#86868b]">{formatDateShort(record.occurredAt)}</p>
                  <p className="mt-2 text-[13px] leading-5 text-[#6e6e73]">{record.summary}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {record.actionTaken ? <p className="text-[12px] font-semibold text-[#1d1d1f]">Action: {record.actionTaken}</p> : <p className="text-[12px] font-semibold text-[#c93400]">Action pending</p>}
                    {canTakeAction ? (
                      <button className="btn-secondary min-h-[34px] px-3 text-[12px]" onClick={() => openActionModal(record)} type="button">
                        {record.actionTaken ? "Update action" : "Take action"}
                      </button>
                    ) : null}
                    {!record.isRestricted ? (
                      <button className="btn-secondary min-h-[34px] px-3 text-[12px]" disabled={notifyingId === record.id} onClick={() => notifyParent(record)} type="button">
                        {notifyingId === record.id ? "Notifying..." : "Notify parent"}
                      </button>
                    ) : null}
                  </div>
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
              <div className="py-2"><EmptyState headline="No achievements" description="No positive achievements yet." /></div>
            ) : (
              recentAchievements.map((record) => (
                <div className="rounded-xl border border-[#34c759]/15 bg-[#34c759]/[0.04] p-4" key={`achievement-${record.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">{record.title}</p>
                    <StatusPill label={severityLabel(record.severity)} tone="good" />
                  </div>
                  <p className="mt-1 text-[12px] font-medium text-[#86868b]">{formatDateShort(record.occurredAt)}</p>
                  <p className="mt-2 text-[13px] leading-5 text-[#6e6e73]">{record.summary}</p>
                  {!record.isRestricted ? (
                    <button className="btn-secondary mt-3 min-h-[34px] px-3 text-[12px]" disabled={notifyingId === record.id} onClick={() => notifyParent(record)} type="button">
                      {notifyingId === record.id ? "Notifying..." : "Notify parent"}
                    </button>
                  ) : null}
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
              {records.map((record) => (
                  <tr className="table-row" key={record.id}>
                    <td className="px-5 py-4 text-[#6e6e73]">{formatDateShort(record.occurredAt)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${typeBadgeClasses(record.type)}`}>{typeLabel(record.type)}</span>
                    </td>
                    <td className="px-5 py-4"><StatusPill label={severityLabel(record.severity)} tone={severityTone(record)} /></td>
                    <td className="max-w-[360px] px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#1d1d1f]">{record.title}</p>
                        {record.isRestricted ? <StatusPill label="Restricted" tone="warn" /> : null}
                      </div>
                      <p className="mt-1 text-[12px] leading-5 text-[#6e6e73]">{record.summary}</p>
                    </td>
                    <td className="px-5 py-4 text-[#6e6e73]">
                      <div className="flex max-w-[220px] flex-col gap-2">
                        <span>{record.actionTaken ?? "Not recorded"}</span>
                        {canTakeAction && record.type === "INCIDENT" ? (
                          <button className="btn-secondary min-h-[34px] px-3 text-[12px]" onClick={() => openActionModal(record)} type="button">
                            {record.actionTaken ? "Update action" : "Take action"}
                          </button>
                        ) : null}
                        {!record.isRestricted ? (
                          <button className="btn-secondary min-h-[34px] px-3 text-[12px]" disabled={notifyingId === record.id} onClick={() => notifyParent(record)} type="button">
                            {notifyingId === record.id ? "Notifying..." : "Notify parent"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#6e6e73]">{record.createdBy?.fullName ?? "System"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {selectedIncident ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <form className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" onSubmit={handleActionSubmit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">Behaviour action</p>
                <h2 className="mt-1 text-[20px] font-semibold text-[#1d1d1f]">{selectedIncident.title}</h2>
                <p className="mt-1 text-[13px] font-medium text-[#86868b]">{formatDateShort(selectedIncident.occurredAt)}</p>
              </div>
              <StatusPill label={severityLabel(selectedIncident.severity)} tone={severityTone(selectedIncident)} />
            </div>

            <div className="mt-5 grid gap-3 rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#f5f5f7]/70 p-4 text-[13px] text-[#6e6e73]">
              <div>
                <p className="font-semibold text-[#1d1d1f]">Incident details</p>
                <p className="mt-1 leading-6">{selectedIncident.summary}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-[#1d1d1f]">Logged by</p>
                  <p className="mt-1">{selectedIncident.createdBy?.fullName ?? "System"}</p>
                </div>
                <div>
                  <p className="font-semibold text-[#1d1d1f]">Current action</p>
                  <p className="mt-1">{selectedIncident.actionTaken ?? "Not recorded"}</p>
                </div>
              </div>
            </div>

            <label className="mt-4 block space-y-1.5">
              <span className="text-[12px] font-semibold text-[#6e6e73]">Action being taken</span>
              <textarea
                autoFocus
                className="glass-input min-h-[120px] resize-none text-[14px] leading-6"
                maxLength={1000}
                placeholder="Write the action taken by principal"
                value={actionText}
                onChange={(event) => setActionText(event.target.value)}
              />
            </label>

            {actionError ? <p className="mt-3 rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{actionError}</p> : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="btn-secondary min-h-[44px] px-5 text-[14px]" onClick={() => setSelectedIncident(null)} type="button">
                Cancel
              </button>
              <button className="btn-primary min-h-[44px] px-5 text-[14px]" disabled={actionSaving} type="submit">
                {actionSaving ? "Saving..." : "Save action"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
