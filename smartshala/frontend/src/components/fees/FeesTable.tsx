"use client";

import Link from "next/link";
import { StatusPill } from "@/components/ui/StatusPill";
import type { FeeAssignmentSummary } from "@/lib/api";
import { formatINR } from "@/lib/formatters";

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
    <div className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white shadow-[var(--shadow-card)]">
      <div className="border-b border-[#DCE1E8] px-4 py-4 sm:px-6 sm:py-5">
        <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Student fee accounts</h2>
        <p className="mt-1 text-[13px] text-[#86868b]">Open a student ledger to record payment or view receipts.</p>
      </div>

      <div className="max-h-[430px] overflow-y-auto p-3 sm:hidden">
        {loading ? (
          <div className="rounded-[8px] border border-[#E2E7EE] px-4 py-10 text-center text-[13px] text-[#86868b]">Loading fee accounts...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-[8px] border border-[#E2E7EE] px-4 py-10 text-center text-[13px] text-[#86868b]">No pending fee accounts found.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <Link className="block rounded-[8px] border border-[#E2E7EE] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] transition-colors hover:border-[#8C96A3]" href={`/fees/${row.studentId}`} key={row.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold leading-5 text-[#1d1d1f]">{row.student.fullName}</p>
                    <p className="mt-0.5 truncate text-[12px] text-[#86868b]">{row.feeStructure.name} - {classLabel(row.student.class)}</p>
                  </div>
                  <StatusPill label={row.status} tone={toneForStatus(row.status)} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-[6px] bg-[#F7F8FB] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">Paid</p>
                    <p className="mt-1 truncate whitespace-nowrap text-[14px] font-semibold text-[#0F1419]">{formatINR(row.paidAmount)}</p>
                  </div>
                  <div className="rounded-[6px] bg-[#FFF2DC] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#B95A00]">Balance</p>
                    <p className="mt-1 truncate whitespace-nowrap text-[14px] font-semibold text-[#0F1419]">{formatINR(row.pendingAmount)}</p>
                  </div>
                </div>
                <p className="mt-3 text-[12px] font-semibold text-[#2456E6]">Open ledger</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="hidden max-h-[520px] overflow-auto sm:block">
        <table className="w-full min-w-[860px] table-fixed text-left text-[13px]">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[12%]" />
            <col className="w-[13%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-[var(--brand-secondary)] text-white">
            <tr>
              {["Student", "Class", "Paid", "Balance", "Status", "Ledger"].map((head) => (
                <th className="px-6 py-3.5 font-semibold" key={head}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
            {loading ? (
              <tr><td className="px-6 py-12 text-center text-[#86868b]" colSpan={6}>Loading fee accounts...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-6 py-12 text-center text-[#86868b]" colSpan={6}>No pending fee accounts found.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="table-row">
                  <td className="px-6 py-4">
                    <Link className="block font-semibold text-[#1d1d1f] transition-colors duration-200 hover:text-[#0071e3]" href={`/fees/${row.studentId}`}>
                      {row.student.fullName}
                    </Link>
                    <p className="mt-0.5 truncate whitespace-nowrap text-[11px] text-[#86868b]" title={row.feeStructure.name}>{row.feeStructure.name}</p>
                  </td>
                  <td className="px-6 py-4 text-[#6e6e73]">{classLabel(row.student.class)}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-[#6e6e73]">{formatINR(row.paidAmount)}</td>
                  <td className="whitespace-nowrap px-6 py-4 font-semibold text-[#1d1d1f]">{formatINR(row.pendingAmount)}</td>
                  <td className="px-6 py-4">
                    <StatusPill label={row.status} tone={toneForStatus(row.status)} />
                    {row.status === "PARTIAL" ? (
                      <p className="mt-1.5 text-[11px] font-medium text-[#86868b]">Paid {formatINR(row.paidAmount, { compact: false })} of {formatINR(row.totalAmount, { compact: false })} - {formatINR(row.pendingAmount, { compact: false })} pending</p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <Link className="text-[13px] font-medium text-[#0071e3] transition-colors hover:text-[#0077ed]" href={`/fees/${row.studentId}`}>
                      Ledger
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
