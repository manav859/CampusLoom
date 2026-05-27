"use client";

import { useEffect, useMemo, useState } from "react";
import { AttendanceSummary } from "@/components/AttendanceSummary";
import { DatePicker } from "@/components/ui/DatePicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { StatusPill } from "@/components/ui/StatusPill";
import { KpiCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { attendanceApi, settingsApi, type AttendanceDashboard, type ClassesTodayReportRow, type SchoolProfile } from "@/lib/api";
import { formatDateShort } from "@/lib/formatters";
import { cachedFetch } from "@/lib/prefetchCache";

type DateFilter = "today" | "yesterday" | "week" | "month" | "custom";

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function filterRange(filter: DateFilter, customDate: string) {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (filter === "yesterday") {
    start.setDate(today.getDate() - 1);
    end.setDate(today.getDate() - 1);
  } else if (filter === "week") {
    start.setDate(today.getDate() - today.getDay());
  } else if (filter === "month") {
    start.setDate(1);
  } else if (filter === "custom") {
    const custom = new Date(customDate);
    start.setTime(custom.getTime());
    end.setTime(custom.getTime());
  }

  return { dateFrom: dateInputValue(start), dateTo: dateInputValue(end) };
}

function csvCell(value: string | number | null) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function AttendanceReportsPage() {
  const [data, setData] = useState<AttendanceDashboard | null>(null);
  const [classRows, setClassRows] = useState<ClassesTodayReportRow[]>([]);
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customDate, setCustomDate] = useState(dateInputValue(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const range = useMemo(() => filterRange(dateFilter, customDate), [customDate, dateFilter]);
  const rangeLabel = range.dateFrom === range.dateTo ? formatDateShort(range.dateFrom) : `${formatDateShort(range.dateFrom)} - ${formatDateShort(range.dateTo)}`;

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      setLoading(true);
      setError("");

      try {
        const cacheKey = `${range.dateFrom}:${range.dateTo}`;
        const [dashboard, attendanceByClass, school] = await Promise.all([
          cachedFetch(`attendance:dashboard:${cacheKey}`, () => attendanceApi.dashboard(range)),
          cachedFetch(`attendance:classesToday:${cacheKey}`, () => attendanceApi.classesTodayReport(range)),
          cachedFetch("settings:schoolProfile", () => settingsApi.schoolProfile())
        ]);

        if (cancelled) return;
        setData(dashboard);
        setClassRows(attendanceByClass);
        setSchoolProfile(school);
        setNotice("");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load attendance reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReports();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const totals = useMemo(
    () => ({
      total: data ? data.students.present + data.students.absent + (data.students.halfDay ?? 0) : 0,
      present: data?.students.present ?? 0,
      absent: data?.students.absent ?? 0,
      late: 0,
      halfDay: data?.students.halfDay ?? 0,
      attended: data?.students.attended
    }),
    [data]
  );

  const pendingClassIds = useMemo(() => new Set(classRows.filter((row) => !row.marked).map((row) => row.classId)), [classRows]);
  const schoolMeta = useMemo(() => {
    if (!schoolProfile) return "";
    return [
      schoolProfile.affiliationBoard ? `Board: ${schoolProfile.affiliationBoard}` : "",
      schoolProfile.udiseNumber ? `U-DISE: ${schoolProfile.udiseNumber}` : "",
      schoolProfile.gstin ? `GSTIN: ${schoolProfile.gstin}` : ""
    ].filter(Boolean).join(" | ");
  }, [schoolProfile]);

  const chartItems = useMemo(
    () =>
      classRows.map((row) => ({
        label: row.className,
        value: row.percentage,
        notMarked: pendingClassIds.has(row.classId)
      })),
    [classRows, pendingClassIds]
  );

  function exportCsv() {
    const rows = [
      [schoolProfile?.name ?? "School", "", "", "", "", "", "", "", ""],
      [schoolMeta, "", "", "", "", "", "", "", ""],
      [`Report range: ${rangeLabel}`, "", "", "", "", "", "", "", ""],
      ["Class", "Teacher", "Marked", "Total", "Present", "Late", "Half day", "Absent", "Rate"],
      ...classRows.map((row) => [
        row.className,
        row.classTeacherName ?? "",
        row.marked ? "Yes" : "No",
        row.total,
        row.present,
        row.late,
        row.halfDay,
        row.absent,
        row.marked ? `${row.percentage}%` : "Pending"
      ])
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-report-${range.dateFrom}-${range.dateTo}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotice(`Exported ${classRows.length} attendance rows.`);
  }

  async function nudgeTeachers() {
    setError("");
    setNotice("");
    try {
      const result = await attendanceApi.nudgePendingTeachers(range);
      setNotice(`Nudged ${result.sentCount} of ${result.pendingCount} pending class teachers.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to nudge teachers");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader hideBreadcrumbs title="Daily attendance report" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <ChartSkeleton height={250} />
          <TableSkeleton rows={4} cols={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;
  }

  const markedCount = data?.markedClasses ?? 0;
  const totalClassesCount = data?.totalClasses ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Daily attendance report"
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary min-h-10 px-4 text-[13px]" disabled={pendingClassIds.size === 0} onClick={nudgeTeachers} type="button">
              Nudge teachers
            </button>
            <button className="btn-primary min-h-10 px-4 text-[13px]" onClick={exportCsv} type="button">
              Export CSV
            </button>
          </div>
        }
      />

      <div className="glass-card-interactive flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {([
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["week", "This week"],
            ["month", "This month"],
            ["custom", "Custom"]
          ] as const).map(([value, label]) => (
            <button
              className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition ${dateFilter === value ? "bg-[#2456E6] text-white" : "border border-[#DCE1E8] bg-white text-[#2A3340] hover:bg-[#F7F8FB]"}`}
              key={value}
              onClick={() => setDateFilter(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {dateFilter === "custom" ? (
            <DatePicker onChange={setCustomDate} value={customDate} />
          ) : null}
          <p className="text-[13px] font-medium text-[#5A6573]">{rangeLabel}</p>
        </div>
      </div>

      {schoolProfile ? (
        <div className="rounded-xl border border-[#DCE1E8] bg-white px-4 py-3 text-[13px] text-[#5A6573]">
          <span className="font-semibold text-[#0F1419]">{schoolProfile.name}</span>
          {schoolMeta ? <span className="ml-2">{schoolMeta}</span> : null}
        </div>
      ) : null}

      {notice ? <div className="rounded-xl bg-[#34c759]/10 p-4 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="kpi-metric-card p-5">
          <p className="kpi-metric-label">Total classes</p>
          <p className="kpi-metric-value">{totalClassesCount}</p>
        </div>
        <div className="kpi-metric-card kpi-metric-card-good p-5">
          <p className="kpi-metric-label">Marked</p>
          <p className="kpi-metric-value">{markedCount}</p>
        </div>
        <div className="kpi-metric-card kpi-metric-card-warn p-5">
          <p className="kpi-metric-label">Pending</p>
          <p className="kpi-metric-value">{data?.pendingClasses ?? 0}</p>
        </div>
        <div className="kpi-metric-card p-5">
          <p className="kpi-metric-label">Avg. attendance (marked)</p>
          <p className="kpi-metric-value">{data?.attendancePercentage ?? 0}%</p>
          <p className="mt-1 text-[12px] font-medium text-[#86868b]">{markedCount} of {totalClassesCount} classes marked</p>
        </div>
      </div>

      <AttendanceSummary
        total={totals.total}
        present={totals.present}
        absent={totals.absent}
        late={totals.late}
        halfDay={totals.halfDay}
        attended={totals.attended}
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-card-interactive p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Class-wise trend</h2>
          <div className="mt-5">
            {chartItems.length > 0 ? <SimpleBarChart items={chartItems} /> : <p className="text-[13px] text-[#86868b]">No classes available.</p>}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Class</th>
                  <th className="px-5 py-3.5 font-semibold">Teacher</th>
                  <th className="px-5 py-3.5 font-semibold">Total</th>
                  <th className="px-5 py-3.5 font-semibold">Present</th>
                  <th className="px-5 py-3.5 font-semibold">Half day</th>
                  <th className="px-5 py-3.5 font-semibold">Absent</th>
                  <th className="px-5 py-3.5 font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {classRows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-[#86868b]" colSpan={7}>
                      No classes available.
                    </td>
                  </tr>
                ) : (
                  classRows.map((row) => (
                    <tr className="table-row" key={row.classId}>
                      <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{row.className}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{row.classTeacherName ?? "-"}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{row.total}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{pendingClassIds.has(row.classId) ? <StatusPill label="Pending" tone="warn" /> : row.present}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{pendingClassIds.has(row.classId) ? "-" : row.halfDay}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{pendingClassIds.has(row.classId) ? "-" : row.absent}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">
                        {pendingClassIds.has(row.classId) ? <StatusPill label="Pending" tone="warn" /> : `${row.percentage}%`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

