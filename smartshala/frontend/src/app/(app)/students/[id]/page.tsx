import Link from "next/link";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";

export default function StudentDetailPage() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Student profile" title="Aarav Patel" action={<Link className="rounded-lg border border-line px-4 py-2 text-sm font-semibold" href="/fees/ledger/demo">Open fee ledger</Link>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Class" value="6-A" />
        <KpiCard label="Monthly attendance" value="72%" tone="danger" />
        <KpiCard label="Pending fees" value="₹18,000" tone="warn" />
        <KpiCard label="Risk" value="High" tone="danger" />
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="font-semibold">Profile</h2>
          <dl className="mt-3 grid gap-2 text-sm text-neutral-700">
            <div className="flex justify-between"><dt>Admission no</dt><dd>ADM-001</dd></div>
            <div className="flex justify-between"><dt>Parent</dt><dd>Parent Aarav</dd></div>
            <div className="flex justify-between"><dt>Phone</dt><dd>9870000000</dd></div>
            <div className="flex justify-between"><dt>Status</dt><dd><StatusPill label="Active" tone="good" /></dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="font-semibold">AI insight</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-700">Aarav has missed 5 marked days this month and also has pending fee installments. Principal follow-up is recommended this week.</p>
        </div>
      </section>
    </div>
  );
}

