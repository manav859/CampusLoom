"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { KpiCardSkeleton, ProfileSkeleton, TableSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { studentsApi, type StudentDetail } from "@/lib/api";

function money(value: string | number) {
  return `Rs ${Number(value ?? 0).toLocaleString("en-IN")}`;
}

function classLabel(student: StudentDetail) {
  return `${student.class.name}-${student.class.section}`;
}

function currentMonthAttendance(records: StudentDetail["attendanceRecords"]) {
  const now = new Date();
  const currentMonthRecords = records.filter((record) => {
    const date = new Date(record.session.date);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });

  const scopedRecords = currentMonthRecords.length > 0 ? currentMonthRecords : records;
  const total = scopedRecords.length;
  const attended = scopedRecords.filter((record) => record.status !== "ABSENT").length;
  const absent = scopedRecords.filter((record) => record.status === "ABSENT").length;

  return {
    total,
    absent,
    percentage: total ? Math.round((attended / total) * 100) : 0
  };
}

function riskLabel(attendancePercentage: number, pendingFees: number) {
  if ((attendancePercentage > 0 && attendancePercentage < 75) || pendingFees > 0) return "High";
  if (attendancePercentage > 0 && attendancePercentage < 85) return "Medium";
  return "Low";
}

function riskTone(risk: string) {
  if (risk === "High") return "danger";
  if (risk === "Medium") return "warn";
  return "good";
}

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    studentsApi.get(params.id)
      .then((data) => {
        if (active) setStudent(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load student");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-32 rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
        <section className="grid gap-4 lg:grid-cols-2">
          <ProfileSkeleton />
          <ProfileSkeleton />
        </section>
        <TableSkeleton rows={3} cols={4} />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;
  }

  if (!student) {
    return <div className="rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] p-12 text-[13px] text-[#86868b] text-center shadow-apple-sm">Student not found.</div>;
  }

  const attendance = currentMonthAttendance(student.attendanceRecords);
  const pendingFees = student.feeAssignments.reduce((sum, assignment) => sum + Number(assignment.pendingAmount ?? 0), 0);
  const paidFees = student.feeAssignments.reduce((sum, assignment) => sum + Number(assignment.paidAmount ?? 0), 0);
  const risk = riskLabel(attendance.percentage, pendingFees);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student profile"
        title={student.fullName}
        action={<Link className="btn-secondary" href={`/fees/${student.id}`}>Open fee ledger →</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Class" value={classLabel(student)} />
        <KpiCard label="Recent attendance" value={attendance.total ? `${attendance.percentage}%` : "No records"} tone={attendance.percentage >= 75 || attendance.total === 0 ? "good" : "danger"} />
        <KpiCard label="Pending fees" value={money(pendingFees)} tone={pendingFees > 0 ? "warn" : "good"} />
        <KpiCard label="Risk" value={risk} tone={riskTone(risk)} />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card-interactive p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Profile</h2>
          <dl className="mt-4 space-y-3 text-[13px]">
            {[
              ["Admission no", student.admissionNumber],
              ["Roll no", student.rollNumber ?? "Not set"],
              ["Parent", student.parentName],
              ["Phone", student.parentPhone],
              ["Alternate phone", student.alternatePhone ?? "Not set"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-[#86868b]">{label}</dt>
                <dd className="font-medium text-[#1d1d1f] text-right">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <dt className="text-[#86868b]">Status</dt>
              <dd><StatusPill label={student.isActive ? "Active" : "Inactive"} tone={student.isActive ? "good" : "neutral"} /></dd>
            </div>
          </dl>
        </div>

        <div className="glass-card-interactive p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Action insight</h2>
          <p className="mt-3 text-[14px] leading-6 text-[#6e6e73]">
            {attendance.absent > 0 || pendingFees > 0
              ? `${student.fullName} has ${attendance.absent} absences in the latest attendance window and ${money(pendingFees)} pending fees. Follow-up is recommended.`
              : `${student.fullName} has no pending fees and no recent attendance risk from the available records.`}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Fees paid</p>
              <p className="mt-1.5 text-[20px] font-semibold tracking-tight text-[#1d1d1f]">{money(paidFees)}</p>
            </div>
            <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Attendance records</p>
              <p className="mt-1.5 text-[20px] font-semibold tracking-tight text-[#1d1d1f]">{attendance.total}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
        <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Fee assignments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="table-head">
              <tr>{["Fee", "Paid", "Pending", "Status"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {student.feeAssignments.length === 0 ? (
                <tr><td className="px-5 py-12 text-center text-[#86868b]" colSpan={4}>No fee assignments found.</td></tr>
              ) : (
                student.feeAssignments.map((assignment) => (
                  <tr key={assignment.id} className="table-row">
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{assignment.feeStructure.name}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{money(assignment.paidAmount)}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{money(assignment.pendingAmount)}</td>
                    <td className="px-5 py-4"><StatusPill label={assignment.status} tone={assignment.status === "PAID" ? "good" : assignment.status === "PARTIAL" ? "warn" : "danger"} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
