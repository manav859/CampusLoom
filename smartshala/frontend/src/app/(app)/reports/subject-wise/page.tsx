"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { marksApi, type MarksExam, type MarksExamDetail } from "@/lib/api";
import { downloadCsv, percent, ReportTable } from "@/features/reports/reportUtils";

type StudentSubjectRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  subject: string;
  exams: number;
  attempted: number;
  pending: number;
  totalPercentage: number;
  bestPercentage: number | null;
  latestExam: string;
  latestDate: string;
  latestGrade: string;
};

function statusFor(avg: number | null) {
  if (avg === null) return { label: "Pending", tone: "warn" as const };
  if (avg >= 85) return { label: "Excellent", tone: "good" as const };
  if (avg >= 70) return { label: "Good", tone: "good" as const };
  if (avg >= 50) return { label: "Needs Attention", tone: "warn" as const };
  return { label: "At Risk", tone: "danger" as const };
}

function average(row: StudentSubjectRow) {
  return row.attempted ? row.totalPercentage / row.attempted : null;
}

export default function SubjectWiseReportPage() {
  const [exams, setExams] = useState<MarksExam[]>([]);
  const [details, setDetails] = useState<MarksExamDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const examRows = await marksApi.exams();
        const enteredExams = examRows.filter((exam) => exam.enteredCount > 0 || exam.pendingCount > 0);
        const detailRows = await Promise.all(enteredExams.map((exam) => marksApi.exam(exam.id)));
        if (!active) return;
        setExams(examRows);
        setDetails(detailRows);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load subject wise student performance");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    const map = new Map<string, StudentSubjectRow>();

    for (const exam of details) {
      for (const student of exam.students) {
        const key = `${student.studentId}:${exam.className}:${exam.subject}`;
        const current = map.get(key) ?? {
          studentId: student.studentId,
          studentName: student.fullName,
          admissionNumber: student.admissionNumber,
          className: exam.className,
          subject: exam.subject,
          exams: 0,
          attempted: 0,
          pending: 0,
          totalPercentage: 0,
          bestPercentage: null,
          latestExam: "-",
          latestDate: "",
          latestGrade: "-"
        };

        current.exams += 1;
        if (student.result) {
          current.attempted += 1;
          current.totalPercentage += student.result.percentage;
          current.bestPercentage = Math.max(current.bestPercentage ?? 0, student.result.percentage);
          if (!current.latestDate || exam.date >= current.latestDate) {
            current.latestDate = exam.date;
            current.latestExam = exam.name;
            current.latestGrade = student.result.grade;
          }
        } else {
          current.pending += 1;
        }

        map.set(key, current);
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const classCompare = a.className.localeCompare(b.className);
      if (classCompare) return classCompare;
      const subjectCompare = a.subject.localeCompare(b.subject);
      if (subjectCompare) return subjectCompare;
      return a.studentName.localeCompare(b.studentName);
    });
  }, [details]);

  function exportCsv() {
    downloadCsv(`student-subject-performance-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Student", "Admission no", "Class", "Subject", "Exams", "Attempted", "Pending", "Average", "Best", "Latest exam", "Grade", "Status"],
      ...rows.map((row) => {
        const avg = average(row);
        return [
          row.studentName,
          row.admissionNumber,
          row.className,
          row.subject,
          row.exams,
          row.attempted,
          row.pending,
          percent(avg),
          percent(row.bestPercentage),
          row.latestExam,
          row.latestGrade,
          statusFor(avg).label
        ];
      })
    ]);
  }

  if (error) return <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Subject wise student performance"
        action={<button className="btn-primary min-h-10 px-4 text-[13px]" disabled={loading || rows.length === 0} onClick={exportCsv} type="button">Export CSV</button>}
      />
      <ReportTable colSpan={12} empty={loading ? "Loading student subject performance..." : exams.length === 0 ? "No exams available." : "No marks available."} isEmpty={loading || rows.length === 0} minWidth="min-w-[1180px]">
        {!loading && rows.length > 0 ? (
          <>
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Student</th>
                <th className="px-5 py-3.5 font-semibold">Admission no</th>
                <th className="px-5 py-3.5 font-semibold">Class</th>
                <th className="px-5 py-3.5 font-semibold">Subject</th>
                <th className="px-5 py-3.5 font-semibold">Exams</th>
                <th className="px-5 py-3.5 font-semibold">Attempted</th>
                <th className="px-5 py-3.5 font-semibold">Pending</th>
                <th className="px-5 py-3.5 font-semibold">Average</th>
                <th className="px-5 py-3.5 font-semibold">Best</th>
                <th className="px-5 py-3.5 font-semibold">Latest exam</th>
                <th className="px-5 py-3.5 font-semibold">Grade</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F5]">
              {rows.map((row) => {
                const avg = average(row);
                const status = statusFor(avg);
                return (
                  <tr className="table-row" key={`${row.studentId}-${row.className}-${row.subject}`}>
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">
                      <Link className="hover:text-[#2456E6]" href={`/students/${row.studentId}`}>{row.studentName}</Link>
                    </td>
                    <td className="px-5 py-4 text-[#5A6573]">{row.admissionNumber}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{row.className}</td>
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{row.subject}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{row.exams}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{row.attempted}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{row.pending}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{percent(avg)}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{percent(row.bestPercentage)}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{row.latestExam}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{row.latestGrade}</td>
                    <td className="px-5 py-4"><StatusPill label={status.label} tone={status.tone} /></td>
                  </tr>
                );
              })}
            </tbody>
          </>
        ) : null}
      </ReportTable>
    </div>
  );
}
