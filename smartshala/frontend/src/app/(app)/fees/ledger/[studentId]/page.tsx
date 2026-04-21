import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";

export default function StudentFeeLedgerPage() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Fee ledger" title="Aarav Patel" action={<button className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white">Add payment</button>} />
      <div className="rounded-lg border border-line bg-panel p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="text-sm text-neutral-500">Annual fee</p><p className="text-xl font-semibold">₹24,000</p></div>
          <div><p className="text-sm text-neutral-500">Paid</p><p className="text-xl font-semibold">₹6,000</p></div>
          <div><p className="text-sm text-neutral-500">Pending</p><p className="text-xl font-semibold">₹18,000</p></div>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600"><tr>{["Installment", "Due date", "Amount", "Status"].map((head) => <th className="px-3 py-3" key={head}>{head}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {["Q1", "Q2", "Q3", "Q4"].map((q, index) => <tr key={q}><td className="px-3 py-3">{q}</td><td className="px-3 py-3">10-{["Jun", "Sep", "Dec", "Mar"][index]}-2026</td><td className="px-3 py-3">₹6,000</td><td className="px-3 py-3"><StatusPill label={index === 0 ? "Paid" : "Pending"} tone={index === 0 ? "good" : "warn"} /></td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

