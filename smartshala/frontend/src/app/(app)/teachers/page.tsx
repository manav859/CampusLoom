import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";

const rows = [
  ["Anita Sharma", "anita@smartshala.local", "6-A, 7-A", "Active"],
  ["Rahul Mehta", "rahul@smartshala.local", "8-B", "Active"]
];

export default function TeachersPage() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Teachers" title="Teacher management" action={<button className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white">Add teacher</button>} />
      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600"><tr>{["Name", "Email", "Assigned classes", "Status"].map((head) => <th className="px-3 py-3" key={head}>{head}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{rows.map((row) => <tr key={row[1]}>{row.map((cell, index) => <td className="px-3 py-3" key={cell}>{index === 3 ? <StatusPill label={cell} tone="good" /> : cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

