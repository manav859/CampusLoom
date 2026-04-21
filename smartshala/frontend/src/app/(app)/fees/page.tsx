import Link from "next/link";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";

export default function FeesDashboardPage() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Fees" title="Collection and pending dues" action={<button className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white">Record payment</button>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total due" value="₹7,20,000" />
        <KpiCard label="Collected" value="₹1,80,000" tone="good" />
        <KpiCard label="Pending" value="₹5,40,000" tone="warn" />
        <KpiCard label="Overdue" value="12" tone="danger" />
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-4"><SimpleBarChart items={[{ label: "Jun", value: 80 }, { label: "Jul", value: 52 }, { label: "Aug", value: 64 }]} /></div>
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="font-semibold">Quick actions</h2>
          <div className="mt-4 grid gap-2">
            <Link className="rounded-lg border border-line px-3 py-2 text-sm font-medium" href="/fees/defaulters">View defaulter list</Link>
            <Link className="rounded-lg border border-line px-3 py-2 text-sm font-medium" href="/fees/ledger/demo">Open student ledger</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

