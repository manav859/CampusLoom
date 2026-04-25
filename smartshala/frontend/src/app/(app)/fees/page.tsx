"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FeeCard } from "@/components/fees/FeeCard";
import { FeesTable } from "@/components/fees/FeesTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { KpiCardSkeleton, TableSkeleton, ChartSkeleton } from "@/components/ui/Skeleton";
import { feesApi, apiFetch, type FeesDashboard } from "@/lib/api";

function money(value: number) {
  return `Rs ${Number(value ?? 0).toLocaleString("en-IN")}`;
}

export default function FeesDashboardPage() {
  const [data, setData] = useState<FeesDashboard | null>(null);
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setIsAdmin(u.role === "ADMIN" || u.role === "PRINCIPAL");
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      feesApi.dashboard(),
      apiFetch<any[]>("/fees/structures")
    ])
      .then(([result, structs]) => {
        if (active) {
          setData(result);
          setStructures(structs || []);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load fees dashboard");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees"
        title="Collection command center"
        action={
          <div className="flex gap-2">
            {isAdmin && <Link className="btn-secondary" href="/fees/new">Create Fee Structure</Link>}
            <Link className="btn-primary" href="/fees/defaulters">View defaulters</Link>
          </div>
        }
      />

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <FeeCard label="Total collection" value={money(data?.totalCollected ?? 0)} tone="good" />
            <FeeCard label="Outstanding" value={money(data?.totalPending ?? 0)} tone="warn" />
            <FeeCard label="Total assigned" value={money(data?.totalDue ?? 0)} />
            <FeeCard label="Defaulters" value={data?.topDefaulters?.length ?? 0} tone="danger" helper="Top pending accounts" />
          </>
        )}
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
        {loading ? (
          <>
            <TableSkeleton rows={5} cols={4} />
            <ChartSkeleton height={320} />
          </>
        ) : (
          <>
            <FeesTable rows={data?.topDefaulters ?? []} loading={false} />
            <div className="glass-card-interactive p-6">
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Collection snapshot</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">Collected versus outstanding for the current fee ledger.</p>
              <div className="mt-5">
                <SimpleBarChart
                  items={[
                    { label: "Collected", value: data?.totalCollected ?? 0 },
                    { label: "Outstanding", value: data?.totalPending ?? 0 }
                  ]}
                />
              </div>
              <div className="mt-5 grid gap-2">
                <Link className="flex items-center justify-between rounded-xl bg-[rgba(0,0,0,0.02)] px-4 py-3.5 text-[13px] font-medium text-[#0071e3] transition-colors hover:bg-[rgba(0,0,0,0.04)]" href="/fees/defaulters">
                  Open defaulter follow-up queue
                  <span className="text-[#86868b]">→</span>
                </Link>
                <Link className="flex items-center justify-between rounded-xl bg-[rgba(0,0,0,0.02)] px-4 py-3.5 text-[13px] font-medium text-[#0071e3] transition-colors hover:bg-[rgba(0,0,0,0.04)]" href="/notifications">
                  Review WhatsApp receipts
                  <span className="text-[#86868b]">→</span>
                </Link>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Fee Structures Section */}
      <section className="space-y-4 pt-4 border-t border-[rgba(0,0,0,0.06)]">
        <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Active Fee Structures</h2>
        <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.06)] shadow-[0_2px_20px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl bg-white/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="bg-gradient-to-r from-[#1a3c4d] to-[#2a7a94]">
                  {["Structure Name", "Academic Year", "Total Amount", "Frequency", "Assigned Class"].map((head) => (
                    <th key={head} className="px-5 py-3.5 text-[12px] font-semibold text-white/90 tracking-wide whitespace-nowrap">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 w-32 bg-gray-200 rounded-md" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-20 bg-gray-200 rounded-md" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-gray-200 rounded-md" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-gray-200 rounded-md" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-gray-200 rounded-md" /></td>
                    </tr>
                  ))
                ) : structures.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-[#86868b]">
                      No fee structures found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  structures.map((fs) => (
                    <tr key={fs.id} className="group transition-colors duration-200 hover:bg-[#f5f5f7]/60">
                      <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{fs.name}</td>
                      <td className="px-5 py-4 text-[#6e6e73] font-medium">{fs.academicYear}</td>
                      <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{money(fs.totalAmount)}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{fs.frequency}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{fs.class ? `${fs.class.name}-${fs.class.section}` : "All Classes"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
