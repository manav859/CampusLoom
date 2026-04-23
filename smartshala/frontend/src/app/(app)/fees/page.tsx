"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FeeCard } from "@/components/fees/FeeCard";
import { FeesTable } from "@/components/fees/FeesTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { feesApi, type FeesDashboard } from "@/lib/api";

function money(value: number) {
  return `Rs ${Number(value ?? 0).toLocaleString("en-IN")}`;
}

export default function FeesDashboardPage() {
  const [data, setData] = useState<FeesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    feesApi.dashboard()
      .then((result) => {
        if (active) setData(result);
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
        action={<Link className="btn-primary" href="/fees/defaulters">View defaulters</Link>}
      />

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FeeCard label="Total collection" value={loading ? "…" : money(data?.totalCollected ?? 0)} tone="good" />
        <FeeCard label="Outstanding" value={loading ? "…" : money(data?.totalPending ?? 0)} tone="warn" />
        <FeeCard label="Total assigned" value={loading ? "…" : money(data?.totalDue ?? 0)} />
        <FeeCard label="Defaulters" value={loading ? "…" : data?.topDefaulters?.length ?? 0} tone="danger" helper="Top pending accounts" />
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
        <FeesTable rows={data?.topDefaulters ?? []} loading={loading} />
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
      </section>
    </div>
  );
}
