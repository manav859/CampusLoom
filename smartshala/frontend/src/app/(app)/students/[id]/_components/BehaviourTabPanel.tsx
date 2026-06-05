import { useEffect, useState, type FormEvent } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { communicationApi, studentsApi, type BehaviourRecordPayload, type StudentDetail } from "@/lib/api";
import { formatDateShort } from "@/lib/formatters";
import { invalidateCache } from "@/lib/prefetchCache";

export type BehaviourTabPanelProps = {
  student: StudentDetail;
};

type BehaviourRecord = StudentDetail["behaviourAnalytics"]["records"][number];
type BehaviourSeverity = NonNullable<BehaviourRecordPayload["severity"]>;
type SelectOption<T extends string> = {
  label: string;
  value: T;
};

function CustomSelect<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <label className="relative block space-y-1.5" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <span className="text-[12px] font-semibold text-[#6e6e73]">{label}</span>
      <button
        className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-left text-[14px] text-[#0F1419] outline-none transition-colors hover:border-[#9EACBD] focus:border-[#2456E6]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="truncate">{selected.label}</span>
        <svg className={`h-4 w-4 shrink-0 text-[#5A6573] transition-transform duration-150 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 16 16">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-full overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white p-1 shadow-[0_14px_34px_-20px_rgba(15,20,25,0.45)]">
          {options.map((option) => (
            <button
              className={`flex min-h-9 w-full items-center rounded-[6px] px-3 text-left text-[13px] font-semibold transition-colors ${
                option.value === value ? "bg-[#EEF3FF] text-[#2456E6]" : "text-[#2A3340] hover:bg-[#F7F8FB]"
              }`}
              key={option.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
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

function defaultSeverity(type: BehaviourRecordPayload["type"]): BehaviourSeverity {
  if (type === "ACHIEVEMENT") return "POSITIVE";
  return "LOW";
}

const typeOptions: SelectOption<BehaviourRecordPayload["type"]>[] = [
  { label: "Incident", value: "INCIDENT" },
  { label: "Achievement", value: "ACHIEVEMENT" }
];

const incidentSeverityOptions: SelectOption<BehaviourSeverity>[] = [
  { label: "Minor", value: "LOW" },
  { label: "Major", value: "MEDIUM" },
  { label: "Critical", value: "HIGH" }
];

const achievementSeverityOptions: SelectOption<BehaviourSeverity>[] = [
  { label: "Positive", value: "POSITIVE" }
];

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
      await communicationApi.sendMessage({
        targetType: "STUDENT",
        studentId: student.id,
        type: "CUSTOM",
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
      {notice ? <div className="rounded-[6px] border border-[#0F8A4A]/20 bg-[#E1F5EA] px-4 py-3 text-[13px] font-medium text-[#128C7E]">{notice}</div> : null}
      {notifyError ? <div className="rounded-[6px] border border-[#FCE3E5] bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{notifyError}</div> : null}

      {canWriteBehaviour ? (
        <form className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5" id="behaviour-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Add Behaviour Record</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">Teacher entries appear in the principal behaviour view.</p>
            </div>
            {formMessage ? <span className="text-[12px] font-semibold text-[#248a3d]">{formMessage}</span> : null}
          </div>

          <div className="mt-4 grid items-end gap-3 md:grid-cols-[168px_168px_minmax(220px,1fr)]">
            <CustomSelect
              label="Type"
              options={typeOptions}
              value={form.type}
              onChange={(type) => setForm((current) => ({ ...current, type, severity: defaultSeverity(type), isRestricted: false }))}
            />

            <CustomSelect
              label="Rating"
              options={form.type === "ACHIEVEMENT" ? achievementSeverityOptions : incidentSeverityOptions}
              value={form.severity ?? defaultSeverity(form.type)}
              onChange={(severity) => setForm((current) => ({ ...current, severity }))}
            />

            <label className="space-y-1.5">
              <span className="text-[12px] font-semibold text-[#6e6e73]">Title</span>
              <input
                className="min-h-[44px] rounded-[6px] border border-[#C9D3DE] px-3 text-[14px] outline-none focus:border-[#2456E6]"
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
                className="min-h-[96px] w-full resize-none rounded-[6px] border border-[#C9D3DE] px-3 py-2 text-[14px] leading-6 outline-none focus:border-[#2456E6]"
                maxLength={2000}
                placeholder="What happened?"
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
              />
            </label>
          </div>

          {formError ? <p className="mt-3 rounded-[6px] border border-[#FCE3E5] bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{formError}</p> : null}

          <div className="mt-4 flex justify-end">
            <button className="btn-primary min-h-[44px] gap-2 px-5 text-[14px]" disabled={saving} type="submit">
              {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
              {saving ? "Saving..." : "Save Behaviour Record"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="kpi-metric-card kpi-metric-card-warn p-4">
          <p className="kpi-metric-label">Incidents</p>
          <p className="kpi-metric-value">{behaviour.counts.incidents}</p>
        </div>
        <div className="kpi-metric-card kpi-metric-card-good p-4">
          <p className="kpi-metric-label">Positive Achievements</p>
          <p className="kpi-metric-value">{behaviour.counts.achievements}</p>
        </div>
        <div className="kpi-metric-card kpi-metric-card-purple p-4">
          <p className="kpi-metric-label">Counsellor Notes</p>
          <p className="kpi-metric-value">{behaviour.counts.counsellorNotes}</p>
        </div>
        <div className="kpi-metric-card p-4">
          <p className="kpi-metric-label">Total Records</p>
          <p className="kpi-metric-value">{behaviour.counts.total}</p>
        </div>
      </div>

      {!behaviour.canViewCounsellorNotes ? (
        <div className="rounded-[6px] border border-[#D8D4FF] bg-[#F5F3FF] p-4 text-[13px] font-medium leading-6 text-[#5856d6]">
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
        <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Recent Incidents</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">Action-focused behaviour signals.</p>
            </div>
            <StatusPill label={`${behaviour.counts.incidents} total`} tone={behaviour.counts.incidents > 0 ? "warn" : "good"} />
          </div>
          <div className="mt-5 space-y-3">
            {recentIncidents.length === 0 ? (
              <div className="py-2"><EmptyState headline="No incidents" description="No recent incidents recorded." /></div>
            ) : (
              recentIncidents.map((record) => (
                <div className="rounded-[6px] border border-[#DCE1E8] p-4" key={`incident-${record.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">{record.title}</p>
                    <StatusPill label={severityLabel(record.severity)} tone={severityTone(record)} />
                  </div>
                  <p className="mt-1 text-[12px] font-medium text-[#86868b]">{formatDateShort(record.occurredAt)}</p>
                  <p className="mt-2 text-[13px] leading-5 text-[#6e6e73]">{record.summary}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {record.actionTaken ? <p className="text-[12px] font-semibold text-[#1d1d1f]">Action: {record.actionTaken}</p> : <p className="text-[12px] font-semibold text-[#c93400]">Action Pending</p>}
                    {canTakeAction ? (
                      <button className="btn-secondary min-h-[34px] px-3 text-[12px]" onClick={() => openActionModal(record)} type="button">
                        {record.actionTaken ? "Update Action" : "Take Action"}
                      </button>
                    ) : null}
                    {!record.isRestricted ? (
                      <button className="btn-secondary min-h-[34px] px-3 text-[12px]" disabled={notifyingId === record.id} onClick={() => notifyParent(record)} type="button">
                        {notifyingId === record.id ? "Notifying..." : "Notify Parent"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Positive Achievements</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">Strengths and growth moments.</p>
            </div>
            <StatusPill label={`${behaviour.counts.achievements} total`} tone="good" />
          </div>
          <div className="mt-5 space-y-3">
            {recentAchievements.length === 0 ? (
              <div className="py-2"><EmptyState headline="No achievements" description="No positive achievements yet." /></div>
            ) : (
              recentAchievements.map((record) => (
                <div className="rounded-[6px] border border-[#BFE9CC] bg-[#F4FBF6] p-4" key={`achievement-${record.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">{record.title}</p>
                    <StatusPill label={severityLabel(record.severity)} tone="good" />
                  </div>
                  <p className="mt-1 text-[12px] font-medium text-[#86868b]">{formatDateShort(record.occurredAt)}</p>
                  <p className="mt-2 text-[13px] leading-5 text-[#6e6e73]">{record.summary}</p>
                  {!record.isRestricted ? (
                    <button className="btn-secondary mt-3 min-h-[34px] px-3 text-[12px]" disabled={notifyingId === record.id} onClick={() => notifyParent(record)} type="button">
                      {notifyingId === record.id ? "Notifying..." : "Notify Parent"}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
        <div className="border-b border-[#E7EBF0] px-5 py-4">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Behaviour Record</h2>
          <p className="mt-0.5 text-[13px] text-[#86868b]">Latest entries first, with restricted notes protected by role.</p>
        </div>
        <div className="space-y-3 p-4 md:hidden">
          {records.map((record) => (
            <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_8px_22px_-18px_rgba(15,20,25,0.35)]" key={`mobile-behaviour-${record.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#0F1419]">{record.title}</p>
                  <p className="mt-1 text-[12px] font-medium text-[#5A6573]">{formatDateShort(record.occurredAt)} - {record.createdBy?.fullName ?? "System"}</p>
                </div>
                <StatusPill label={severityLabel(record.severity)} tone={severityTone(record)} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-[6px] px-2.5 py-1 text-[11px] font-semibold ${typeBadgeClasses(record.type)}`}>{typeLabel(record.type)}</span>
                {record.isRestricted ? <StatusPill label="Restricted" tone="warn" /> : null}
              </div>
              <p className="mt-3 text-[13px] leading-5 text-[#424B57]">{record.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canTakeAction && record.type === "INCIDENT" ? (
                  <button className="btn-secondary min-h-[34px] px-3 text-[12px]" onClick={() => openActionModal(record)} type="button">
                    {record.actionTaken ? "Update Action" : "Take Action"}
                  </button>
                ) : null}
                {!record.isRestricted ? (
                  <button className="btn-secondary min-h-[34px] px-3 text-[12px]" disabled={notifyingId === record.id} onClick={() => notifyParent(record)} type="button">
                    {notifyingId === record.id ? "Notifying..." : "Notify Parent"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[920px] border-collapse bg-white text-center text-[14px] text-[#001B33]">
            <thead>
              <tr className="table-head-row">
                {["Date", "Type", "Severity", "Details", "Action", "Logged by"].map((head) => (
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center text-[14px] font-semibold text-[#031526]" key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                  <tr className="transition-colors duration-200 hover:bg-[#F8FBFD]" key={record.id}>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{formatDateShort(record.occurredAt)}</td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${typeBadgeClasses(record.type)}`}>{typeLabel(record.type)}</span>
                    </td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center"><StatusPill label={severityLabel(record.severity)} tone={severityTone(record)} /></td>
                    <td className="max-w-[360px] border-b border-[#C9D3DE] px-4 py-4 text-center">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#1d1d1f]">{record.title}</p>
                        {record.isRestricted ? <StatusPill label="Restricted" tone="warn" /> : null}
                      </div>
                      <p className="mt-1 text-[12px] leading-5 text-[#6e6e73]">{record.summary}</p>
                    </td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">
                      <div className="flex max-w-[220px] flex-col gap-2">
                        <span>{record.actionTaken ?? "Not recorded"}</span>
                        {canTakeAction && record.type === "INCIDENT" ? (
                          <button className="btn-secondary min-h-[34px] px-3 text-[12px]" onClick={() => openActionModal(record)} type="button">
                            {record.actionTaken ? "Update Action" : "Take Action"}
                          </button>
                        ) : null}
                        {!record.isRestricted ? (
                          <button className="btn-secondary min-h-[34px] px-3 text-[12px]" disabled={notifyingId === record.id} onClick={() => notifyParent(record)} type="button">
                            {notifyingId === record.id ? "Notifying..." : "Notify Parent"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{record.createdBy?.fullName ?? "System"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {selectedIncident ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4">
          <form className="w-full max-w-2xl rounded-[6px] bg-white p-6 shadow-2xl" onSubmit={handleActionSubmit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">Behaviour Action</p>
                <h2 className="mt-1 text-[20px] font-semibold text-[#1d1d1f]">{selectedIncident.title}</h2>
                <p className="mt-1 text-[13px] font-medium text-[#86868b]">{formatDateShort(selectedIncident.occurredAt)}</p>
              </div>
              <StatusPill label={severityLabel(selectedIncident.severity)} tone={severityTone(selectedIncident)} />
            </div>

            <div className="mt-5 grid gap-3 rounded-[6px] border border-[#DCE1E8] bg-[#F7F8FB] p-4 text-[13px] text-[#6e6e73]">
              <div>
                <p className="font-semibold text-[#1d1d1f]">Incident Details</p>
                <p className="mt-1 leading-6">{selectedIncident.summary}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-[#1d1d1f]">Logged By</p>
                  <p className="mt-1">{selectedIncident.createdBy?.fullName ?? "System"}</p>
                </div>
                <div>
                  <p className="font-semibold text-[#1d1d1f]">Current Action</p>
                  <p className="mt-1">{selectedIncident.actionTaken ?? "Not recorded"}</p>
                </div>
              </div>
            </div>

            <label className="mt-4 block space-y-1.5">
              <span className="text-[12px] font-semibold text-[#6e6e73]">Action Being Taken</span>
              <textarea
                autoFocus
                className="min-h-[120px] w-full resize-none rounded-[6px] border border-[#C9D3DE] px-3 py-2 text-[14px] leading-6 outline-none focus:border-[#2456E6]"
                maxLength={1000}
                placeholder="Write the action taken by principal"
                value={actionText}
                onChange={(event) => setActionText(event.target.value)}
              />
            </label>

            {actionError ? <p className="mt-3 rounded-[6px] border border-[#FCE3E5] bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{actionError}</p> : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="btn-secondary min-h-[44px] px-5 text-[14px]" onClick={() => setSelectedIncident(null)} type="button">
                Cancel
              </button>
              <button className="btn-primary min-h-[44px] gap-2 px-5 text-[14px]" disabled={actionSaving} type="submit">
                {actionSaving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
                {actionSaving ? "Saving..." : "Save Action"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
