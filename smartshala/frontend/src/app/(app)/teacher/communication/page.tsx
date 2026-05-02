"use client";

import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  communicationApi,
  type CommunicationContext,
  type CommunicationMessageType,
  type TeacherCommunicationLog
} from "@/lib/api";

const messageTemplates: Record<CommunicationMessageType, string> = {
  ATTENDANCE_ALERT: "Dear parent, please note that your child's attendance needs attention. Kindly connect with the class teacher.",
  HOMEWORK_REMINDER: "Dear parent, this is a reminder to help your child complete the assigned homework by the due date.",
  CUSTOM: ""
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function typeLabel(type: CommunicationMessageType) {
  if (type === "ATTENDANCE_ALERT") return "Attendance alert";
  if (type === "HOMEWORK_REMINDER") return "Homework reminder";
  return "Custom";
}

function statusTone(status: TeacherCommunicationLog["status"]) {
  if (status === "SENT" || status === "COMPLETED") return "good";
  if (status === "FAILED" || status === "MISSED") return "danger";
  if (status === "QUEUED") return "warn";
  return "neutral";
}

export default function TeacherCommunicationPage() {
  const [context, setContext] = useState<CommunicationContext>({ classes: [] });
  const [logs, setLogs] = useState<TeacherCommunicationLog[]>([]);
  const [targetType, setTargetType] = useState<"STUDENT" | "CLASS">("STUDENT");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [messageType, setMessageType] = useState<CommunicationMessageType>("ATTENDANCE_ALERT");
  const [message, setMessage] = useState(messageTemplates.ATTENDANCE_ALERT);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedClass = useMemo(() => context.classes.find((classRecord) => classRecord.id === classId) ?? null, [context.classes, classId]);
  const students = selectedClass?.students ?? [];
  const selectedStudent = useMemo(() => students.find((student) => student.id === studentId) ?? null, [students, studentId]);
  const recipientCount = targetType === "CLASS" ? students.length : selectedStudent ? 1 : 0;

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [communicationContext, messageLogs] = await Promise.all([communicationApi.context(), communicationApi.messages()]);
        if (!active) return;
        setContext(communicationContext);
        setLogs(messageLogs);
        const firstClass = communicationContext.classes[0];
        setClassId(firstClass?.id ?? "");
        setStudentId(firstClass?.students[0]?.id ?? "");
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
    setMessage(messageTemplates[nextType]);
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
                <option value="ATTENDANCE_ALERT">Attendance alert</option>
                <option value="HOMEWORK_REMINDER">Homework reminder</option>
                <option value="CUSTOM">Custom message</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Message</span>
              <textarea
                className="mt-1.5 min-h-[150px] w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[#0071e3]"
                disabled={sending}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write the parent message"
                value={message}
              />
            </label>

            <div className="rounded-xl bg-[#f5f5f7] px-4 py-3 text-[13px] text-[#6e6e73]">
              <span className="font-semibold text-[#1d1d1f]">{recipientCount}</span> parent contact{recipientCount === 1 ? "" : "s"} selected.
              {selectedStudent ? <span> Current parent: {selectedStudent.parentPhone}</span> : null}
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
                ) : logs.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-[#86868b]" colSpan={5}>No parent messages sent yet.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr className="table-row" key={log.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#1d1d1f]">{log.studentName}</p>
                        <p className="mt-1 text-[12px] text-[#86868b]">{log.className} | Roll {log.rollNumber ?? "-"}</p>
                      </td>
                      <td className="px-5 py-4 text-[#6e6e73]">{typeLabel(log.type)}</td>
                      <td className="px-5 py-4">
                        <p className="line-clamp-2 max-w-[360px] text-[#6e6e73]">{log.message}</p>
                      </td>
                      <td className="px-5 py-4"><StatusPill label={log.status} tone={statusTone(log.status)} /></td>
                      <td className="px-5 py-4 text-[#6e6e73]">{dateLabel(log.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
