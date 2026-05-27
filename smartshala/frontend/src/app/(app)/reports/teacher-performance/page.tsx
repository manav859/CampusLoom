"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { apiFetch, attendanceApi, type ClassesTodayReportRow } from "@/lib/api";
import { downloadCsv, percent, ReportTable } from "@/features/reports/reportUtils";

type TeacherPeriod = {
  classId: string | null;
  subjectName: string;
};

type TeacherRow = {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  periodAssignments?: TeacherPeriod[];
  classTeacherFor?: { id: string; name: string; section: string }[];
};

function classTeacherLabel(teacher: TeacherRow) {
  const classes = teacher.classTeacherFor ?? [];
  return classes.length ? classes.map((item) => `${item.name}-${item.section}`).join(", ") : "-";
}

function toneForCoverage(value: number | null) {
  if (value === null) return "neutral";
  if (value >= 90) return "good";
  if (value >= 70) return "warn";
  return "danger";
}

export default function TeacherPerformanceReportPage() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<ClassesTodayReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [teacherData, attendanceData] = await Promise.all([
          apiFetch<{ items: TeacherRow[] }>("/users/teachers?limit=100"),
          attendanceApi.classesTodayReport()
        ]);
        if (!active) return;
        setTeachers(teacherData.items);
        setAttendanceRows(attendanceData);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load teacher performance report");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => teachers.map((teacher) => {
    const assignedPeriods = (teacher.periodAssignments ?? []).filter((period) => period.classId).length;
    const subjects = Array.from(new Set((teacher.periodAssignments ?? []).filter((period) => period.classId).map((period) => period.subjectName))).filter((item) => item && item !== "Free period");
    const ownedClassNames = new Set((teacher.classTeacherFor ?? []).map((item) => `${item.name}-${item.section}`));
    const attendanceForTeacher = attendanceRows.filter((row) => row.classTeacherName === teacher.fullName || ownedClassNames.has(row.className));
    const marked = attendanceForTeacher.filter((row) => row.marked).length;
    const pending = attendanceForTeacher.filter((row) => !row.marked).length;
    const total = marked + pending;
    const coverage = total > 0 ? Math.round((marked / total) * 100) : null;
    return { teacher, assignedPeriods, subjects, marked, pending, coverage };
  }), [attendanceRows, teachers]);

  function exportCsv() {
    downloadCsv(`teacher-performance-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Teacher", "Phone", "Class teacher for", "Assigned periods", "Subjects", "Attendance marked", "Attendance pending", "Coverage", "Status"],
      ...rows.map((row) => [
        row.teacher.fullName,
        row.teacher.phone,
        classTeacherLabel(row.teacher),
        row.assignedPeriods,
        row.subjects.join("; "),
        row.marked,
        row.pending,
        percent(row.coverage),
        row.teacher.status
      ])
    ]);
  }

  if (error) return <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Teacher performance"
        action={<button className="btn-primary min-h-10 px-4 text-[13px]" disabled={loading || rows.length === 0} onClick={exportCsv} type="button">Export CSV</button>}
      />
      <ReportTable colSpan={9} empty={loading ? "Loading teachers..." : "No teachers found."} isEmpty={loading || rows.length === 0} minWidth="min-w-[1080px]">
        {!loading && rows.length > 0 ? (
          <>
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Teacher</th>
                <th className="px-5 py-3.5 font-semibold">Phone</th>
                <th className="px-5 py-3.5 font-semibold">Class teacher for</th>
                <th className="px-5 py-3.5 font-semibold">Assigned periods</th>
                <th className="px-5 py-3.5 font-semibold">Subjects</th>
                <th className="px-5 py-3.5 font-semibold">Marked</th>
                <th className="px-5 py-3.5 font-semibold">Pending</th>
                <th className="px-5 py-3.5 font-semibold">Coverage</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F5]">
              {rows.map((row) => (
                <tr className="table-row" key={row.teacher.id}>
                  <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{row.teacher.fullName}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{row.teacher.phone}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{classTeacherLabel(row.teacher)}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{row.assignedPeriods}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{row.subjects.length ? row.subjects.join(", ") : "-"}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{row.marked}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{row.pending}</td>
                  <td className="px-5 py-4"><StatusPill label={percent(row.coverage)} tone={toneForCoverage(row.coverage)} /></td>
                  <td className="px-5 py-4"><StatusPill label={row.teacher.status} tone={row.teacher.status === "ACTIVE" ? "good" : "warn"} /></td>
                </tr>
              ))}
            </tbody>
          </>
        ) : null}
      </ReportTable>
    </div>
  );
}
