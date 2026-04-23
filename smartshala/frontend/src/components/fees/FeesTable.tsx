"use client";

import Link from "next/link";
import { StatusPill } from "@/components/ui/StatusPill";
import type { FeeAssignmentSummary } from "@/lib/api";

function money(value: string | number) {
  return `Rs ${Number(value ?? 0).toLocaleString("en-IN")}`;
}

function classLabel(classRecord?: { name: string; section: string }) {
  if (!classRecord) return "Unassigned";
  return `${classRecord.name}-${classRecord.section}`;
}

function toneForStatus(status: FeeAssignmentSummary["status"]) {
  if (status === "PAID") return "good";
  if (status === "PARTIAL") return "warn";
  return "danger";
}

export function FeesTable({ rows, loading }: { rows: FeeAssignmentSummary[]; loading?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
      <div className="border-b border-[rgba(0,0,0,0.06)] px-6 py-5">
        <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Student fee accounts</h2>
        <p className="mt-1 text-[13px] text-[#86868b]">Open a student ledger to record payment or view receipts.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="table-head">
            <tr>
              {["Student", "Class", "Paid", "Balance", "Status", ""].map((head) => (
                <th className="px-6 py-3.5 font-semibold" key={head}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
            {loading ? (
              <tr><td className="px-6 py-12 text-center text-[#86868b]" colSpan={6}>Loading fee accounts…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-6 py-12 text-center text-[#86868b]" colSpan={6}>No pending fee accounts found.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="table-row">
                  <td className="px-6 py-4">
                    <Link className="block font-semibold text-[#1d1d1f] transition-colors duration-200 hover:text-[#0071e3]" href={`/fees/${row.studentId}`}>
                      {row.student.fullName}
                    </Link>
                    <p className="text-[11px] text-[#86868b] mt-0.5">{row.feeStructure.name}</p>
                  </td>
                  <td className="px-6 py-4 text-[#6e6e73]">{classLabel(row.student.class)}</td>
                  <td className="px-6 py-4 text-[#6e6e73]">{money(row.paidAmount)}</td>
                  <td className="px-6 py-4 font-semibold text-[#1d1d1f]">{money(row.pendingAmount)}</td>
                  <td className="px-6 py-4"><StatusPill label={row.status} tone={toneForStatus(row.status)} /></td>
                  <td className="px-6 py-4 text-right">
                    <Link className="text-[13px] font-medium text-[#0071e3] hover:text-[#0077ed] transition-colors" href={`/fees/${row.studentId}`}>
                      Ledger →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
