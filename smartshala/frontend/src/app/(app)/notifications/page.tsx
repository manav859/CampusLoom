import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";

const logs = [
  ["ABSENCE", "9870000001", "Sent", "Today, 10:05 AM"],
  ["FEE_REMINDER", "9870000002", "Queued", "Today, 11:15 AM"],
  ["MONTHLY_REPORT", "9870000003", "Failed", "Yesterday"]
];

export default function NotificationsPage() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="WhatsApp" title="Parent notification logs" action={<button className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white">Send message</button>} />
      <div className="rounded-lg border border-line bg-panel p-4">
        <p className="text-sm text-neutral-600">Parents do not login in V1. Every absence, fee reminder, receipt, and monthly report is logged here before or after WhatsApp delivery.</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600"><tr>{["Type", "Recipient", "Status", "Time"].map((head) => <th className="px-3 py-3" key={head}>{head}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {logs.map((row) => (
              <tr key={`${row[0]}-${row[1]}`}>
                <td className="px-3 py-3">{row[0]}</td>
                <td className="px-3 py-3">{row[1]}</td>
                <td className="px-3 py-3"><StatusPill label={row[2]} tone={row[2] === "Sent" ? "good" : row[2] === "Failed" ? "danger" : "warn"} /></td>
                <td className="px-3 py-3">{row[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

