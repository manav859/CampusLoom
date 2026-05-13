"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import type { StudentDetail } from "@/lib/api";
import { money, type AttendanceSummary } from "./studentProfileUtils";

export type AcademicTabPanelProps = {
  student: StudentDetail;
  attendance: AttendanceSummary;
  pendingFees: number;
  paidFees: number;
};

export default function AcademicTabPanel({ student, attendance, pendingFees, paidFees }: AcademicTabPanelProps) {
  const analytics = student.academicAnalytics;
  const hasExams = analytics.exams.length > 0;
  const hasTrend = analytics.trend.length > 0;
  const hasSubjects = analytics.subjects.length > 0;
  const trendRows = analytics.trend.map((item, index) => ({
    ...item,
    label: `${item.examName}${analytics.trend.filter((row) => row.examName === item.examName).length > 1 ? ` ${index + 1}` : ""}`
  }));
  const subjectRows = [...analytics.subjects].sort((a, b) => b.studentAverage - a.studentAverage || a.subject.localeCompare(b.subject));
  const profileRows: { label: string; value: ReactNode }[] = [
    { label: "Admission no", value: student.admissionNumber },
    { label: "Roll no", value: student.rollNumber ?? "Not set" },
    { label: "Parent", value: student.parentName },
    { label: "Phone", value: student.parentPhone },
    { label: "Alternate phone", value: student.alternatePhone ?? "Not set" }
  ];

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card-interactive p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Profile</h2>
          <dl className="mt-4 space-y-3 text-[13px]">
            {profileRows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-[#86868b]">{row.label}</dt>
                <dd className="text-right font-medium text-[#1d1d1f]">{row.value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <dt className="text-[#86868b]">Status</dt>
              <dd>
                <StatusPill label={student.isActive ? "Active" : "Inactive"} tone={student.isActive ? "good" : "neutral"} />
              </dd>
            </div>
          </dl>
        </div>

        <div className="glass-card-interactive p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Action insight</h2>
          <p className="mt-3 text-[14px] leading-6 text-[#6e6e73]">
            {hasExams
              ? `${student.fullName} is averaging ${student.examAverage ?? 0}% across exams with ${student.homeworkCompletion ?? 0}% homework completion. Every exam mark is benchmarked against the class average below.`
              : attendance.absent > 0 || pendingFees > 0
                ? `${student.fullName} has ${attendance.absent} absences in the latest attendance window and ${money(pendingFees)} pending fees. Follow-up is recommended.`
                : `${student.fullName} has no pending fees and no recent attendance risk from the available records.`}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Fees paid</p>
              <p className="mt-1.5 text-[20px] font-semibold tracking-tight text-[#1d1d1f]">{money(paidFees)}</p>
            </div>
            <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Attendance records</p>
              <p className="mt-1.5 text-[20px] font-semibold tracking-tight text-[#1d1d1f]">{attendance.total}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
        <div className="flex flex-col gap-1 border-b border-[rgba(0,0,0,0.06)] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Exam analytics</h2>
            <p className="text-[12px] font-medium text-[#86868b]">Each mark includes class average, grade, and rank.</p>
          </div>
          <StatusPill label={`${analytics.exams.length} marks`} tone={hasExams ? "good" : "neutral"} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="table-head">
              <tr>
                {["Exam Name", "Subject", "Marks", "%", "Class Average", "Grade", "Rank"].map((head) => (
                  <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {!hasExams ? (
                <tr>
                  <td className="px-5 py-8" colSpan={7}>
                    <EmptyState headline="No exam marks" description="No exam marks have been recorded for this student yet." />
                  </td>
                </tr>
              ) : (
                analytics.exams.map((exam) => (
                  <tr key={exam.id} className="table-row">
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{exam.examName}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{exam.subject}</td>
                    <td className="px-5 py-4 text-[#1d1d1f]">{exam.marks}</td>
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{exam.percentage}%</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{exam.classAverage}%</td>
                    <td className="px-5 py-4"><StatusPill label={exam.grade} tone={exam.percentage >= 70 ? "good" : exam.percentage >= 50 ? "warn" : "danger"} /></td>
                    <td className="px-5 py-4 text-[#6e6e73]">{exam.rank ? `#${exam.rank}` : "Not ranked"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Exam score comparison</h2>
              <p className="mt-1 text-[12px] font-medium text-[#86868b]">Student score against class average for the latest exams.</p>
            </div>
          </div>
          <div className="mt-4 h-[320px]">
            {hasTrend ? (
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={trendRows} margin={{ bottom: 8, left: -22, right: 8, top: 12 }}>
                  <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="label" interval={0} tick={{ fontSize: 11, fill: "#86868b" }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#86868b" }} tickLine={false} unit="%" />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend iconType="circle" />
                  <Bar dataKey="student" fill="#0071e3" name="Student" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="classAverage" fill="#34c759" name="Class avg" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] font-medium text-[#86868b]">Trend appears after exam marks are recorded.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Subject analysis</h2>
              <p className="mt-1 text-[12px] font-medium text-[#86868b]">Clear side-by-side averages by subject.</p>
            </div>
          </div>
          <div className="mt-5">
            {hasSubjects ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-[12px] font-semibold text-[#6e6e73]">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0071e3]" /> Student</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#34c759]" /> Class avg</span>
                </div>
                {subjectRows.map((subject) => (
                  <div key={subject.subject} className="rounded-xl border border-[rgba(0,0,0,0.05)] bg-[#fbfbfd] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">{subject.subject}</p>
                      <p className="text-[12px] font-semibold text-[#6e6e73]">
                        Gap {Math.abs(subject.studentAverage - subject.classAverage)}%
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-[74px_1fr_42px] items-center gap-2">
                        <span className="text-[12px] font-medium text-[#0071e3]">Student</span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#e5e5ea]">
                          <div className="h-full rounded-full bg-[#0071e3]" style={{ width: `${Math.max(0, Math.min(100, subject.studentAverage))}%` }} />
                        </div>
                        <span className="text-right text-[12px] font-semibold text-[#1d1d1f]">{subject.studentAverage}%</span>
                      </div>
                      <div className="grid grid-cols-[74px_1fr_42px] items-center gap-2">
                        <span className="text-[12px] font-medium text-[#248a3d]">Class</span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#e5e5ea]">
                          <div className="h-full rounded-full bg-[#34c759]" style={{ width: `${Math.max(0, Math.min(100, subject.classAverage))}%` }} />
                        </div>
                        <span className="text-right text-[12px] font-semibold text-[#1d1d1f]">{subject.classAverage}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[260px] items-center justify-center text-[13px] font-medium text-[#86868b]">Subject comparison appears after marks are recorded.</div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple">
        <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Homework completion by subject</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {!hasSubjects ? (
            <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4 text-[13px] font-medium text-[#86868b]">No subject homework data recorded yet.</div>
          ) : (
            analytics.subjects.map((subject) => (
              <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4" key={subject.subject}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">{subject.subject}</p>
                  <p className="text-[13px] font-semibold text-[#0071e3]">{subject.homeworkCompletion}%</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5e5ea]">
                  <div className="h-full rounded-full bg-[#0071e3]" style={{ width: `${subject.homeworkCompletion}%` }} />
                </div>
                <p className="mt-2 text-[12px] text-[#86868b]">Exam avg {subject.studentAverage}% - Class avg {subject.classAverage}%</p>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
