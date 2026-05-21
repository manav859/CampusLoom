"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  communicationApi,
  type CommunicationContext,
  type CommunicationMessageType,
  type TeacherCommunicationLog
} from "@/lib/api";
import {
  communicationTemplates,
  renderCommunicationTemplate,
  templateForType,
  templateLabel,
  type TemplateLanguage,
  type TemplateVariables
} from "@/lib/communicationTemplates";
import { formatDateTimeShort } from "@/lib/formatters";
import { cachedFetch } from "@/lib/prefetchCache";

function statusTone(status: TeacherCommunicationLog["status"]) {
  if (status === "SENT" || status === "COMPLETED") return "good";
  if (status === "FAILED" || status === "MISSED") return "danger";
  if (status === "QUEUED") return "warn";
  return "neutral";
}

function todayDisplay() {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
}

function defaultMessage(type: CommunicationMessageType, language: TemplateLanguage, variables: TemplateVariables) {
  const template = templateForType(type);
  if (!template) return "";
  return renderCommunicationTemplate(template.variants[language], variables);
}

const teacherQuickTemplates = [
  {
    label: "Homework reminder",
    type: "HOMEWORK_REMINDER" as CommunicationMessageType
  },
  {
    label: "Class cancelled",
    message: "Dear parent, today's class for Class {className} is cancelled. Please check the next school update for revised schedule."
  },
  {
    label: "PTM invite",
    type: "PTM_INVITE" as CommunicationMessageType
  },
  {
    label: "Sick child sent home",
    message: "Dear parent, {studentName} felt unwell today. Please contact {teacherName} and arrange pickup if needed."
  }
];

type TeacherQuickTemplate = { label: string; type: CommunicationMessageType } | { label: string; message: string };

export default function TeacherCommunicationPage() {
  const [context, setContext] = useState<CommunicationContext>({ classes: [] });
  const [logs, setLogs] = useState<TeacherCommunicationLog[]>([]);
  const [targetType, setTargetType] = useState<"STUDENT" | "CLASS">("STUDENT");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [messageType, setMessageType] = useState<CommunicationMessageType>("ATTENDANCE_ALERT");
  const [language, setLanguage] = useState<TemplateLanguage>("en");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState<CommunicationMessageType | "ALL">("ALL");
  const [logStatusFilter, setLogStatusFilter] = useState<TeacherCommunicationLog["status"] | "ALL">("ALL");
  const [logPage, setLogPage] = useState(1);
  const [expandedLog, setExpandedLog] = useState<TeacherCommunicationLog | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const selectedClass = useMemo(() => context.classes.find((classRecord) => classRecord.id === classId) ?? null, [context.classes, classId]);
  const students = selectedClass?.students ?? [];
  const selectedStudent = useMemo(() => students.find((student) => student.id === studentId) ?? null, [students, studentId]);
  const recipientCount = targetType === "CLASS" ? students.length : selectedStudent ? 1 : 0;
  const templateVariables = useMemo<TemplateVariables>(() => ({
    studentName: selectedStudent?.fullName ?? "{studentName}",
    className: selectedClass ? `${selectedClass.name}-${selectedClass.section}` : "{className}",
    schoolName: "SmartShala Ahmedabad Public School",
    date: todayDisplay(),
    amount: "INR 2,500",
    dueDate: todayDisplay(),
    examName: "Unit Test 1",
    ptmTime: "10:00 AM",
    holidayReason: "school notice",
    teacherName: "Class teacher"
  }), [selectedClass, selectedStudent]);
  const selectedTemplate = templateForType(messageType);
  const filteredLogs = useMemo(
    () => logs.filter((log) =>
      (logTypeFilter === "ALL" || log.type === logTypeFilter) &&
      (logStatusFilter === "ALL" || log.status === logStatusFilter)
    ),
    [logs, logStatusFilter, logTypeFilter]
  );
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const visibleLogs = filteredLogs.slice((logPage - 1) * pageSize, logPage * pageSize);

  useEffect(() => {
    if (messageType !== "CUSTOM") {
      setMessage(defaultMessage(messageType, language, templateVariables));
    }
  }, [language, messageType, templateVariables]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [communicationContext, messageLogs] = await Promise.all([
          cachedFetch("communication:context", () => communicationApi.context()),
          cachedFetch("communication:messages", () => communicationApi.messages())
        ]);
        if (!active) return;
        setContext(communicationContext);
        setLogs(messageLogs);
        const firstClass = communicationContext.classes[0];
        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const requestedClass = params?.get("classId");
        const requestedStudent = params?.get("studentId");
        const initialClass = communicationContext.classes.find((classRecord) => classRecord.id === requestedClass) ?? firstClass;
        setClassId(initialClass?.id ?? "");
        setStudentId(
          initialClass?.students.find((student) => student.id === requestedStudent)?.id ??
          initialClass?.students[0]?.id ??
          ""
        );
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load communication module");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  async function refreshLogs(nextClassId = classId) {
    const rows = await communicationApi.messages(nextClassId || undefined);
    setLogs(rows);
  }

  async function handleClassChange(nextClassId: string) {
    const nextClass = context.classes.find((classRecord) => classRecord.id === nextClassId) ?? null;
    setClassId(nextClassId);
    setStudentId(nextClass?.students[0]?.id ?? "");
    setError("");
    try {
      await refreshLogs(nextClassId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load communication logs");
    }
  }

  function handleMessageTypeChange(nextType: CommunicationMessageType) {
    setMessageType(nextType);
    setMessage(defaultMessage(nextType, language, templateVariables));
  }

  function applyQuickTemplate(template: TeacherQuickTemplate) {
    if ("type" in template && template.type) {
      handleMessageTypeChange(template.type);
      return;
    }
    if (!("message" in template)) return;
    setMessageType("CUSTOM");
    setMessage(renderCommunicationTemplate(template.message, templateVariables));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId) {
      setError("Select a class before sending a message.");
      return;
    }
    if (targetType === "STUDENT" && !studentId) {
      setError("Select a student before sending an individual message.");
      return;
    }
    if (!message.trim()) {
      setError("Message is required.");
      return;
    }

    setSending(true);
    setError("");
    setNotice("");
    try {
      const result = await communicationApi.sendMessage({
        targetType,
        classId: targetType === "CLASS" ? classId : undefined,
        studentId: targetType === "STUDENT" ? studentId : undefined,
        type: messageType,
        message: message.trim()
      });
      setLogs((current) => [...result.logs, ...current.filter((log) => !result.logs.some((sent) => sent.id === log.id))]);
      setNotice(`Message queued for ${result.count} parent${result.count === 1 ? "" : "s"}.`);
      await refreshLogs(classId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Teacher workspace</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[#1d1d1f]">Parent communication</h1>
        </div>
        <StatusPill label={`${logs.length} logs`} tone={logs.length ? "good" : "neutral"} />
      </div>

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div> : null}
      {notice ? <div className="rounded-xl bg-[#34c759]/10 p-4 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[410px_1fr]">
        <form className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple" onSubmit={handleSubmit}>
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Send message</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Class</span>
              <select
                className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                disabled={loading || sending}
                onChange={(event) => handleClassChange(event.target.value)}
                value={classId}
              >
                {context.classes.length === 0 ? <option value="">No assigned classes</option> : null}
                {context.classes.map((classRecord) => (
                  <option key={classRecord.id} value={classRecord.id}>
                    Class {classRecord.name}-{classRecord.section} ({classRecord.students.length} students)
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Send to</span>
              <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-xl bg-[#f5f5f7] p-1">
                {[
                  { value: "STUDENT", label: "Individual student" },
                  { value: "CLASS", label: "Entire class" }
                ].map((option) => (
                  <button
                    className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${targetType === option.value ? "bg-white text-[#1d1d1f] shadow-apple-sm" : "text-[#6e6e73] hover:text-[#1d1d1f]"}`}
                    key={option.value}
                    onClick={() => setTargetType(option.value as "STUDENT" | "CLASS")}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {targetType === "STUDENT" ? (
              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Student</span>
                <select
                  className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                  disabled={loading || sending || students.length === 0}
                  onChange={(event) => setStudentId(event.target.value)}
                  value={studentId}
                >
                  {students.length === 0 ? <option value="">No students</option> : null}
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName} - {student.parentPhone}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Message type</span>
              <select
                className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                disabled={sending}
                onChange={(event) => handleMessageTypeChange(event.target.value as CommunicationMessageType)}
                value={messageType}
              >
                {communicationTemplates.map((template) => (
                  <option key={template.type} value={template.type}>{template.label}</option>
                ))}
                <option value="CUSTOM">Custom message</option>
              </select>
            </label>

            {selectedTemplate ? (
              <div>
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Language</span>
                <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-xl bg-[#f5f5f7] p-1">
                  {[
                    { value: "en", label: "English" },
                    { value: "hi", label: "Hindi" }
                  ].map((option) => (
                    <button
                      className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${language === option.value ? "bg-white text-[#1d1d1f] shadow-apple-sm" : "text-[#6e6e73] hover:text-[#1d1d1f]"}`}
                      key={option.value}
                      onClick={() => setLanguage(option.value as TemplateLanguage)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] font-medium text-[#86868b]">{selectedTemplate.description}</p>
              </div>
            ) : null}

            <div>
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Teacher quick templates</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {teacherQuickTemplates.map((template) => (
                  <button
                    className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]"
                    key={template.label}
                    onClick={() => applyQuickTemplate(template)}
                    type="button"
                  >
                    {template.label}
                  </button>
                ))}
                <button
                  className="rounded-lg border border-[#C2C9D4] bg-[#F7F8FB] px-3 py-1.5 text-[12px] font-semibold text-[#2456E6] hover:bg-white"
                  onClick={() => setLibraryOpen((open) => !open)}
                  type="button"
                >
                  Template library
                </button>
              </div>
              {libraryOpen ? (
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[#DCE1E8] bg-white p-3">
                  {communicationTemplates.map((template) => (
                    <button
                      className="w-full rounded-lg border border-[#DCE1E8] px-3 py-2 text-left hover:bg-[#F7F8FB]"
                      key={template.type}
                      onClick={() => {
                        handleMessageTypeChange(template.type);
                        setLibraryOpen(false);
                      }}
                      type="button"
                    >
                      <span className="block text-[12px] font-semibold text-[#1d1d1f]">{template.label}</span>
                      <span className="mt-0.5 block text-[11px] font-medium text-[#86868b]">{template.description}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Message</span>
              <textarea
                className="mt-1.5 min-h-[150px] w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium leading-6 text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[#0071e3]"
                disabled={sending}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write the parent message"
                value={message}
              />
            </label>

            {selectedTemplate ? (
              <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-white px-4 py-3 text-[12px] text-[#6e6e73]">
                <p className="font-semibold text-[#1d1d1f]">Template preview</p>
                <p className="mt-2 leading-5">{renderCommunicationTemplate(selectedTemplate.variants.en, templateVariables)}</p>
                <p className="mt-2 leading-6">{renderCommunicationTemplate(selectedTemplate.variants.hi, templateVariables)}</p>
              </div>
            ) : null}

            <div className="rounded-xl bg-[#f5f5f7] px-4 py-3 text-[13px] text-[#6e6e73]">
              <span className="font-semibold text-[#1d1d1f]">{recipientCount}</span>{` ${recipientCount === 1 ? "parent contact" : "parent contacts"} selected.`}
              {selectedStudent ? <span>{` Current parent: ${selectedStudent.parentPhone}`}</span> : null}
            </div>

            <button
              className="w-full rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              disabled={sending || loading || recipientCount === 0 || !message.trim()}
              type="submit"
            >
              {sending ? "Queueing..." : "Send to parent"}
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
          <div className="flex flex-col gap-3 border-b border-[rgba(0,0,0,0.06)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Communication log</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">Latest parent messages appear first and feed the student profile log.</p>
            </div>
            {selectedClass ? <StatusPill label={`Class ${selectedClass.name}-${selectedClass.section}`} tone="neutral" /> : null}
          </div>
          <div className="flex flex-wrap gap-2 border-b border-[rgba(0,0,0,0.06)] px-5 py-3">
            <select className="rounded-lg border border-[#DCE1E8] bg-white px-3 py-2 text-[12px] font-semibold text-[#2A3340]" onChange={(event) => { setLogTypeFilter(event.target.value as CommunicationMessageType | "ALL"); setLogPage(1); }} value={logTypeFilter}>
              <option value="ALL">All types</option>
              {communicationTemplates.map((template) => <option key={template.type} value={template.type}>{template.label}</option>)}
              <option value="CUSTOM">Custom message</option>
            </select>
            <select className="rounded-lg border border-[#DCE1E8] bg-white px-3 py-2 text-[12px] font-semibold text-[#2A3340]" onChange={(event) => { setLogStatusFilter(event.target.value as TeacherCommunicationLog["status"] | "ALL"); setLogPage(1); }} value={logStatusFilter}>
              <option value="ALL">All statuses</option>
              {["QUEUED", "SENT", "FAILED", "COMPLETED", "MISSED", "NOTE"].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-[13px]">
              <thead className="table-head">
                <tr>
                  {["Student", "Type", "Message", "Status", "Timestamp"].map((head) => (
                    <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 5 }).map((__, cell) => (
                        <td className="px-5 py-4" key={cell}><Skeleton className="h-4 w-24 rounded-md" /></td>
                      ))}
                    </tr>
                  ))
                ) : visibleLogs.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8" colSpan={5}>
                      <EmptyState headline="No messages" description="No parent messages sent yet." />
                    </td>
                  </tr>
                ) : (
                  visibleLogs.map((log) => (
                    <tr className="table-row" key={log.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#1d1d1f]">{log.studentName}</p>
                        <p className="mt-1 text-[12px] text-[#86868b]">{log.className} | Roll {log.rollNumber ?? "-"}</p>
                      </td>
                      <td className="px-5 py-4 text-[#6e6e73]">{templateLabel(log.type)}</td>
                      <td className="px-5 py-4">
                        <p className="line-clamp-1 max-w-[360px] text-[#6e6e73]">{log.message}</p>
                        <button className="mt-1 text-[12px] font-semibold text-[#2456E6]" onClick={() => setExpandedLog(log)} type="button">
                          View full
                        </button>
                      </td>
                      <td className="px-5 py-4"><StatusPill label={log.status} tone={statusTone(log.status)} /></td>
                      <td className="px-5 py-4 text-[#6e6e73]">{formatDateTimeShort(log.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && filteredLogs.length > pageSize ? (
            <div className="flex items-center justify-between border-t border-[rgba(0,0,0,0.06)] px-5 py-3 text-[12px] font-semibold text-[#5A6573]">
              <span>Page {logPage} of {pageCount}</span>
              <div className="flex gap-2">
                <button className="rounded-lg border border-[#DCE1E8] px-3 py-1.5 disabled:opacity-50" disabled={logPage === 1} onClick={() => setLogPage((page) => Math.max(1, page - 1))} type="button">Previous</button>
                <button className="rounded-lg border border-[#DCE1E8] px-3 py-1.5 disabled:opacity-50" disabled={logPage === pageCount} onClick={() => setLogPage((page) => Math.min(pageCount, page + 1))} type="button">Next</button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
      {expandedLog ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4">
          <button aria-label="Close message" className="absolute inset-0" onClick={() => setExpandedLog(null)} type="button" />
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-semibold text-[#1d1d1f]">{templateLabel(expandedLog.type)}</h2>
                <p className="mt-1 text-[13px] text-[#86868b]">{expandedLog.studentName} | {formatDateTimeShort(expandedLog.timestamp)}</p>
              </div>
              <button className="rounded-lg bg-[#F1F3F6] px-3 py-1.5 text-[12px] font-semibold text-[#2A3340]" onClick={() => setExpandedLog(null)} type="button">Close</button>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-[14px] leading-6 text-[#2A3340]">{expandedLog.message}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
