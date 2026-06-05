"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { apiFetch, attendanceApi, type ClassesTodayReportRow } from "@/lib/api";
import { downloadCsv, exportPdfReport, percent, ReportExportActions, ReportTable } from "@/features/reports/reportUtils";

type TeacherPeriod = {
  classId: string | null;
  subjectName: string;
  dayOfWeek?: string;
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

  const rows = useMemo(() => {
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const todayStr = days[new Date().getDay()];

    return teachers.map((teacher) => {
      const todayPeriods = (teacher.periodAssignments ?? []).filter((period) => period.dayOfWeek === todayStr && period.classId);
      const assignedPeriods = todayPeriods.length;
      const subjects = Array.from(new Set(todayPeriods.map((period) => period.subjectName))).filter((item) => item && item !== "Free period");
      
      const ownedClassNames = new Set((teacher.classTeacherFor ?? []).map((item) => `${item.name}-${item.section}`));
      const taughtClassIdsToday = new Set(todayPeriods.map(p => p.classId));
      
      const attendanceForTeacher = attendanceRows.filter((row) => 
        row.classTeacherName === teacher.fullName || 
        ownedClassNames.has(row.className) ||
        taughtClassIdsToday.has(row.classId)
      );
      
      const marked = attendanceForTeacher.filter((row) => row.marked).map(r => r.className).join(', ') || '-';
      const pending = attendanceForTeacher.filter((row) => !row.marked).map(r => r.className).join(', ') || '-';
      
      return { teacher, assignedPeriods, subjects, marked, pending };
    });
  }, [attendanceRows, teachers]);

  function reportRows() {
    return [
      ["Teacher", "Phone", "Class teacher for", "Assigned periods", "Subjects", "Attendance marked", "Attendance pending", "Status"],
      ...rows.map((row) => [
        row.teacher.fullName,
        row.teacher.phone,
        classTeacherLabel(row.teacher),
        row.assignedPeriods,
        row.subjects.join("; "),
        row.marked,
        row.pending,
        row.teacher.status
      ])
    ];
  }

  function exportCsv() {
    downloadCsv(`teacher-performance-${new Date().toISOString().slice(0, 10)}.csv`, reportRows());
  }

  function exportPdf() {
    exportPdfReport({
      filename: `teacher-performance-${new Date().toISOString().slice(0, 10)}.pdf`,
      rows: reportRows(),
      title: "Teacher performance"
    });
  }

  if (error) return <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Teacher Performance"
        action={<ReportExportActions disabled={loading || rows.length === 0} onExportCsv={exportCsv} onExportPdf={exportPdf} />}
      />
      <ReportTable colSpan={8} empty={loading ? "Loading teachers..." : "No teachers found."} isEmpty={loading || rows.length === 0} minWidth="min-w-[1080px]">
        {!loading && rows.length > 0 ? (
          <>
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3.5 font-semibold text-center whitespace-nowrap">Teacher</th>
                <th className="px-5 py-3.5 font-semibold text-center whitespace-nowrap">Phone</th>
                <th className="px-5 py-3.5 font-semibold text-center whitespace-nowrap">Class Teacher For</th>
                <th className="px-5 py-3.5 font-semibold text-center whitespace-nowrap">Assigned Periods</th>
                <th className="px-5 py-3.5 font-semibold text-center whitespace-nowrap">Subjects</th>
                <th className="px-5 py-3.5 font-semibold text-center whitespace-nowrap">Marked</th>
                <th className="px-5 py-3.5 font-semibold text-center whitespace-nowrap">Pending</th>
                <th className="px-5 py-3.5 font-semibold text-center whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F5]">
              {rows.map((row) => (
                <tr className="table-row" key={row.teacher.id}>
                  <td className="px-5 py-4 font-semibold text-[#1d1d1f] text-center whitespace-nowrap">{row.teacher.fullName}</td>
                  <td className="px-5 py-4 text-[#5A6573] text-center whitespace-nowrap">{row.teacher.phone}</td>
                  <td className="px-5 py-4 text-[#5A6573] text-center">{classTeacherLabel(row.teacher)}</td>
                  <td className="px-5 py-4 text-[#5A6573] text-center">{row.assignedPeriods}</td>
                  <td className="px-5 py-4 text-[#5A6573] text-center">{row.subjects.length ? row.subjects.join(", ") : "-"}</td>
                  <td className="px-5 py-4 text-[#5A6573] text-center">{row.marked}</td>
                  <td className="px-5 py-4 text-[#5A6573] text-center">{row.pending}</td>
                  <td className="px-5 py-4 text-center"><StatusPill label={row.teacher.status} tone={row.teacher.status === "ACTIVE" ? "good" : "warn"} /></td>
                </tr>
              ))}
            </tbody>
          </>
        ) : null}
      </ReportTable>
    </div>
  );
}
