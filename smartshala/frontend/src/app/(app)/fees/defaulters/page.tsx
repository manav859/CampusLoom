import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";

const rows = [
  ["Aarav Patel", "6-A", "₹18,000", "2 days"],
  ["Anaya Patel", "6-A", "₹18,000", "2 days"],
  ["Meera Patel", "7-A", "₹24,000", "15 days"]
];

export default function DefaultersPage() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Fees" title="Pending dues and defaulters" action={<button className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white">Send reminders</button>} />
      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600"><tr>{["Student", "Class", "Pending", "Overdue", "Action"].map((head) => <th className="px-3 py-3" key={head}>{head}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row[0]}>
                <td className="px-3 py-3 font-medium">{row[0]}</td>
                <td className="px-3 py-3">{row[1]}</td>
                <td className="px-3 py-3">{row[2]}</td>
                <td className="px-3 py-3"><StatusPill label={row[3]} tone="danger" /></td>
                <td className="px-3 py-3"><button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold">WhatsApp</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

