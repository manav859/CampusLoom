"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { formatDateShort } from "@/lib/formatters";
import { money, type AttendanceSummary } from "./studentProfileUtils";

export type AcademicTabPanelProps = {
  student: StudentDetail;
  attendance: AttendanceSummary;
  pendingFees: number;
  paidFees: number;
};

function comparisonText(studentAverage: number, classAverage: number) {
  const diff = Math.round(studentAverage - classAverage);
  if (diff > 0) return `You are ${diff}% above class average`;
  if (diff < 0) return `You are ${Math.abs(diff)}% below class average`;
  return "You match class average";
}

function comparisonTone(studentAverage: number, classAverage: number) {
  const diff = studentAverage - classAverage;
  if (diff >= 5) return "text-[#0F8A4A]";
  if (diff <= -5) return "text-[#C8242C]";
  return "text-[#B95A00]";
}

function withUniqueExamLabels<T extends { examName: string; examDate: string }>(rows: T[]) {
  const totals = rows.reduce((map, row) => map.set(row.examName, (map.get(row.examName) ?? 0) + 1), new Map<string, number>());
  const seen = new Map<string, number>();

  return rows.map((row) => {
    const next = (seen.get(row.examName) ?? 0) + 1;
    seen.set(row.examName, next);

    if ((totals.get(row.examName) ?? 0) <= 1) return { ...row, displayExamName: row.examName };

    const dateLabel = formatDateShort(row.examDate);
    return {
      ...row,
      displayExamName: dateLabel === "-" ? `${row.examName} #${next}` : `${row.examName} - ${dateLabel}`
    };
  });
}

function marksDistribution(rows: { percentage: number }[]) {
  const buckets = [
    { label: "0-39", min: 0, max: 39, tone: "bg-[#C8242C]" },
    { label: "40-59", min: 40, max: 59, tone: "bg-[#B95A00]" },
    { label: "60-79", min: 60, max: 79, tone: "bg-[#2456E6]" },
    { label: "80-100", min: 80, max: 100, tone: "bg-[#0F8A4A]" }
  ];

  return buckets.map((bucket) => ({
    ...bucket,
    count: rows.filter((row) => row.percentage >= bucket.min && row.percentage <= bucket.max).length
  }));
}

type ChartTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
};

function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-[6px] border border-[#C9D3DE] bg-white px-3 py-2 text-[12px] shadow-[0_12px_30px_-18px_rgba(15,20,25,0.45)]">
      <p className="mb-1 max-w-[180px] truncate font-semibold text-[#0F1419]">{label}</p>
      {payload.map((item) => (
        <p className="flex items-center gap-2 font-medium text-[#44515F]" key={item.name}>
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
          <span>{item.name}: {item.value}%</span>
        </p>
      ))}
    </div>
  );
}

export default function AcademicTabPanel({ student, attendance, pendingFees, paidFees }: AcademicTabPanelProps) {
  const [isMobileChart, setIsMobileChart] = useState(false);
  const analytics = student.academicAnalytics;
  const hasExams = analytics.exams.length > 0;
  const hasTrend = analytics.trend.length > 0;
  const hasSubjects = analytics.subjects.length > 0;
  const examRows = withUniqueExamLabels(analytics.exams);
  const trendRows = withUniqueExamLabels(analytics.trend).map((item) => ({ ...item, label: item.displayExamName }));
  const subjectRows = [...analytics.subjects].sort((a, b) => b.studentAverage - a.studentAverage || a.subject.localeCompare(b.subject));
  const distributionRows = marksDistribution(analytics.exams);
  const distributionMax = Math.max(1, ...distributionRows.map((row) => row.count));
  const riskSignals = [
    attendance.percentage < 75 ? `Attendance below 75% at ${attendance.percentage}%` : null,
    pendingFees > 0 ? `${money(pendingFees)} pending fees` : null,
    (student.examAverage ?? 0) > 0 && (student.examAverage ?? 0) < 50 ? `Exam average below pass band at ${student.examAverage}%` : null,
    (student.homeworkCompletion ?? 0) > 0 && (student.homeworkCompletion ?? 0) < 60 ? `Homework completion low at ${student.homeworkCompletion}%` : null
  ].filter(Boolean) as string[];
  const profileRows: { label: string; value: ReactNode }[] = [
    { label: "Admission no", value: <span className="type-code">{student.admissionNumber}</span> },
    { label: "Roll no", value: student.rollNumber ?? "Not set" },
    { label: "Parent", value: student.parentName },
    { label: "Phone", value: student.parentPhone },
    { label: "Alternate phone", value: student.alternatePhone ?? "Not set" }
  ];
  const insightHelp =
    "How is this generated? It uses latest exam average, homework completion, attendance count, and pending fees from this profile.";

  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsMobileChart(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-5 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Profile</h2>
          <dl className="mt-4 space-y-3 text-[13px]">
            {profileRows.map((row) => (
              <div key={row.label} className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-[#86868b]">{row.label}</dt>
                <dd className="break-words font-medium text-[#1d1d1f] sm:text-right">{row.value}</dd>
              </div>
            ))}
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-[#86868b]">Status</dt>
              <dd>
                <StatusPill label={student.isActive ? "Active" : "Inactive"} tone={student.isActive ? "good" : "neutral"} />
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-5 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#7e53db]/20 bg-[#7e53db]/10 text-[11px] font-bold tracking-normal text-[#6341ac]">
                AI
              </span>
              <h2 className="truncate text-[17px] font-semibold text-[#1d1d1f]">Action insight</h2>
            </div>
            <button
              aria-label="How is this generated?"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-[#DCE1E8] bg-white text-[12px] font-bold text-[#6e6e73] transition-colors hover:bg-[#F7F8FB]"
              title={insightHelp}
              type="button"
            >
              ?
            </button>
          </div>
          <p className="mt-3 text-[14px] leading-6 text-[#6e6e73]">
            {hasExams
              ? `${student.fullName} is averaging ${student.examAverage ?? 0}% across exams with ${student.homeworkCompletion ?? 0}% homework completion. Every exam mark is benchmarked against the class average below.`
              : attendance.absent > 0 || pendingFees > 0
                ? `${student.fullName} has ${attendance.absent} absences in the latest attendance window and ${money(pendingFees)} pending fees. Follow-up is recommended.`
                : `${student.fullName} has no pending fees and no recent attendance risk from the available records.`}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="kpi-metric-card kpi-metric-card-good min-h-[96px] p-4">
              <p className="kpi-metric-label">Fees paid</p>
              <p className="kpi-metric-value text-[24px] leading-7">{money(paidFees)}</p>
            </div>
            <div className="kpi-metric-card min-h-[96px] p-4">
              <p className="kpi-metric-label">Attendance records</p>
              <p className="kpi-metric-value text-[24px] leading-7">{attendance.total}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#E7EBF0] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
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
                {["Exam Name", "Subject", "Marks", "%", "Class Average", "Vs class", "Grade", "Rank"].map((head) => (
                  <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {!hasExams ? (
                <tr>
                  <td className="px-5 py-8" colSpan={8}>
                    <EmptyState headline="No exam marks" description="No exam marks have been recorded for this student yet." />
                  </td>
                </tr>
              ) : (
                examRows.map((exam) => (
                  <tr key={exam.id} className="table-row">
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{exam.displayExamName}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{exam.subject}</td>
                    <td className="px-5 py-4 text-[#1d1d1f]">{exam.marks}</td>
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{exam.percentage}%</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{exam.classAverage}%</td>
                    <td className={`px-5 py-4 text-[12px] font-semibold ${comparisonTone(exam.percentage, exam.classAverage)}`}>
                      {comparisonText(exam.percentage, exam.classAverage)}
                    </td>
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
        <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Exam score comparison</h2>
              <p className="mt-1 text-[12px] font-medium text-[#86868b]">Student score against class average for the latest exams.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] font-semibold text-[#5A6573]">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#2456E6]" /> Student</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0F8A4A]" /> Class average</span>
          </div>
          <div
            className="mt-4 h-[280px] outline-none sm:h-[320px] [&_.recharts-bar-rectangle]:outline-none [&_.recharts-layer]:outline-none [&_.recharts-rectangle]:outline-none [&_.recharts-surface]:outline-none [&_*:focus]:outline-none"
            onMouseDown={(event) => event.preventDefault()}
          >
            {hasTrend ? (
              <ResponsiveContainer height="100%" width="100%">
                <BarChart barCategoryGap={isMobileChart ? 12 : 18} data={trendRows} margin={{ bottom: isMobileChart ? 0 : 8, left: -22, right: 8, top: 12 }}>
                  <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    height={isMobileChart ? 8 : 42}
                    interval={0}
                    tick={isMobileChart ? false : { fontSize: 11, fill: "#5A6573" }}
                    tickLine={false}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#86868b" }} tickLine={false} unit="%" />
                  <Tooltip content={<ChartTooltip />} cursor={false} />
                  <Legend iconType="circle" />
                  <Bar activeBar={false} dataKey="student" fill="#2456E6" isAnimationActive={false} name="Student" radius={[4, 4, 0, 0]} />
                  <Bar activeBar={false} dataKey="classAverage" fill="#0F8A4A" isAnimationActive={false} name="Class avg" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] font-medium text-[#86868b]">Trend appears after exam marks are recorded.</div>
            )}
          </div>
        </div>

        <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5">
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
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#2456E6]" /> Student</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0F8A4A]" /> Class avg</span>
                </div>
                {subjectRows.map((subject) => (
                  <div key={subject.subject} className="rounded-[6px] border border-[#E7EBF0] bg-[#F7F8FB] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">{subject.subject}</p>
                      <p className="text-[12px] font-semibold text-[#6e6e73]">
                        Gap {Math.abs(subject.studentAverage - subject.classAverage)}%
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-[74px_1fr_42px] items-center gap-2">
                        <span className="text-[12px] font-medium text-[#2456E6]">Student</span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#e5e5ea]">
                          <div className="h-full rounded-full bg-[#2456E6]" style={{ width: `${Math.max(0, Math.min(100, subject.studentAverage))}%` }} />
                        </div>
                        <span className="text-right text-[12px] font-semibold text-[#1d1d1f]">{subject.studentAverage}%</span>
                      </div>
                      <div className="grid grid-cols-[74px_1fr_42px] items-center gap-2">
                        <span className="text-[12px] font-medium text-[#0F8A4A]">Class</span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#e5e5ea]">
                          <div className="h-full rounded-full bg-[#0F8A4A]" style={{ width: `${Math.max(0, Math.min(100, subject.classAverage))}%` }} />
                        </div>
                        <span className="text-right text-[12px] font-semibold text-[#1d1d1f]">{subject.classAverage}%</span>
                      </div>
                    </div>
                    <p className={`mt-3 text-[12px] font-semibold ${comparisonTone(subject.studentAverage, subject.classAverage)}`}>
                      {comparisonText(subject.studentAverage, subject.classAverage)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[260px] items-center justify-center text-[13px] font-medium text-[#86868b]">Subject comparison appears after marks are recorded.</div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Marks distribution</h2>
              <p className="mt-1 text-[12px] font-medium text-[#86868b]">Histogram of this student&apos;s recorded exam percentages.</p>
            </div>
            <StatusPill label={`${analytics.exams.length} exams`} tone={hasExams ? "good" : "neutral"} />
          </div>
          <div className="mt-5 grid h-[220px] grid-cols-4 items-end gap-3">
            {distributionRows.map((bucket) => (
              <div className="flex h-full flex-col justify-end gap-2" key={bucket.label}>
                <div className="flex min-h-[160px] items-end rounded-[6px] bg-[#F7F8FB] px-3 py-2">
                  <div
                    aria-label={`${bucket.count} exams in ${bucket.label}`}
                    className={`w-full rounded-t-lg ${bucket.tone}`}
                    style={{ height: `${Math.max(8, (bucket.count / distributionMax) * 100)}%` }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[12px] font-bold text-[#0F1419]">{bucket.count}</p>
                  <p className="text-[11px] font-semibold text-[#86868b]">{bucket.label}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">At-risk signals</h2>
          <p className="mt-1 text-[12px] font-medium text-[#86868b]">Signals combine attendance, fees, marks, and homework.</p>
          <div className="mt-5 space-y-3">
            {riskSignals.length === 0 ? (
              <div className="rounded-[6px] bg-[#E1F5EA] p-4 text-[13px] font-semibold text-[#0F8A4A]">No active academic risk signal.</div>
            ) : (
              riskSignals.map((signal) => (
                <div className="rounded-[6px] border border-[#FCE3E5] bg-[#FCE3E5]/60 p-4" key={signal}>
                  <p className="text-[13px] font-semibold text-[#C8242C]">{signal}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>

      <section className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5">
        <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Homework completion by subject</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {!hasSubjects ? (
            <div className="rounded-[6px] bg-[#F7F8FB] p-4 text-[13px] font-medium text-[#86868b]">No subject homework data recorded yet.</div>
          ) : (
            analytics.subjects.map((subject) => (
              <div className="rounded-[6px] bg-[#F7F8FB] p-4" key={subject.subject}>
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
