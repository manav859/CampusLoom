import { PageHeader } from "@/components/ui/PageHeader";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { StatusPill } from "@/components/ui/StatusPill";

export default function AttendanceReportsPage() {
  const rows = [
    ["6-A", "28", "26", "2", "93%"],
    ["7-A", "30", "25", "5", "83%"],
    ["8-B", "29", "Pending", "-", "-"]
  ];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Reports" title="Daily attendance report" />
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-line bg-panel p-4">
          <SimpleBarChart items={[{ label: "6-A", value: 93 }, { label: "7-A", value: 83 }, { label: "8-B", value: 0 }]} />
        </div>
        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>{["Class", "Total", "Present", "Absent", "Rate"].map((head) => <th className="px-3 py-3" key={head}>{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row[0]}>{row.map((cell, index) => <td className="px-3 py-3" key={cell}>{index === 4 && cell === "-" ? <StatusPill label="Pending" tone="warn" /> : cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

