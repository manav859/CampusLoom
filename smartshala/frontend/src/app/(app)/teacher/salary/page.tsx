"use client";

import { useEffect, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton } from "@/components/ui/Skeleton";
import { payrollApi, type MySalarySlips, type SalarySlip } from "@/lib/api";
import { formatINR } from "@/lib/formatters";

function monthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function dayLabel(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Whole rupees unless there are paise — the same as the teacher app. */
function rupees(value: number) {
  return formatINR(value, { compact: false, maximumFractionDigits: Number.isInteger(value) ? 0 : 2 });
}

function statusText(slip: SalarySlip) {
  if (slip.status === "PENDING") return "Pending";
  return slip.paidOn ? `Paid on ${dayLabel(slip.paidOn)}` : "Paid";
}

/** The teacher's own recorded slips — the same data as the app's Salary tab. */
export default function TeacherSalaryPage() {
  const [data, setData] = useState<MySalarySlips | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    payrollApi
      .mySlips()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load your salary");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const latest = data?.summary.latest ?? null;

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Teacher Workspace</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[#1d1d1f]">Salary Details</h1>
      </div>

      {error ? <div className="rounded-[8px] bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : !latest ? (
        <div className="rounded-[8px] border border-[#DCE1E8] bg-white px-6 py-14 text-center">
          <p className="text-[16px] font-semibold text-[#0F1419]">No salary slips yet</p>
          <p className="mt-1 text-[13px] text-[#5A6573]">Your slips appear here once the school records them.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <section className="rounded-[8px] border border-[#DCE1E8] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-[#5A6573]">Latest slip · {monthLabel(latest.month)}</p>
                  <p className="mt-1 text-[30px] font-bold text-[#0F1419] [font-variant-numeric:tabular-nums]">{rupees(latest.netPay)}</p>
                  <p className="text-[12px] text-[#86868b]">Net pay</p>
                </div>
                <StatusPill label={statusText(latest)} tone={latest.status === "PAID" ? "good" : "warn"} />
              </div>
              <dl className="mt-5 divide-y divide-[#EEF1F5] rounded-[8px] border border-[#EEF1F5] text-[14px]">
                <BreakdownRow label="Basic pay" value={rupees(latest.basicPay)} />
                <BreakdownRow label="Allowances" value={`+ ${rupees(latest.allowances)}`} />
                <BreakdownRow label="Deductions" tone="text-[#C8242C]" value={`− ${rupees(latest.deductions)}`} />
                <BreakdownRow label="Net pay" strong value={rupees(latest.netPay)} />
              </dl>
              {latest.note ? <p className="mt-3 text-[13px] text-[#5A6573]">Note: {latest.note}</p> : null}
            </section>

            <section className="rounded-[8px] bg-[#EAF9EB] px-5 py-5">
              <p className="text-[14px] font-medium text-[#6F7480]">Paid in {data?.summary.year}</p>
              <p className="mt-2 text-[27px] font-bold text-[#111827] [font-variant-numeric:tabular-nums]">{rupees(data?.summary.paidThisYear ?? 0)}</p>
              <p className="mt-1 text-[12px] text-[#5A6573]">Sum of net pay on slips marked paid this year.</p>
            </section>
          </div>

          <section className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white">
            <h2 className="border-b border-[#DCE1E8] px-5 py-3 text-[15px] font-semibold text-[#0F1419]">Salary Slips</h2>
            <ul className="divide-y divide-[#EEF1F5]">
              {data?.items.map((slip) => (
                <li className="flex flex-wrap items-center justify-between gap-2 px-5 py-3" key={slip.id}>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#0F1419]">{monthLabel(slip.month)}</p>
                    <p className="text-[12px] text-[#5A6573]">
                      Basic {rupees(slip.basicPay)} · Allowances {rupees(slip.allowances)} · Deductions {rupees(slip.deductions)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[15px] font-bold text-[#0F1419] [font-variant-numeric:tabular-nums]">{rupees(slip.netPay)}</span>
                    <StatusPill label={slip.status === "PAID" ? "Paid" : "Pending"} tone={slip.status === "PAID" ? "good" : "warn"} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function BreakdownRow({ label, value, strong = false, tone = "text-[#0F1419]" }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${strong ? "bg-[#F7F8FB]" : ""}`}>
      <dt className={strong ? "font-semibold text-[#0F1419]" : "text-[#5A6573]"}>{label}</dt>
      <dd className={`[font-variant-numeric:tabular-nums] ${strong ? "font-bold text-[#0F1419]" : `font-medium ${tone}`}`}>{value}</dd>
    </div>
  );
}
