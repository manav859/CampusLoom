import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

const reports = [
  {
    href: "/attendance/reports",
    title: "Daily attendance report",
    copy: "Printable attendance scope, pending classes, marked-only averages, and CSV export.",
    action: "Open report"
  },
  {
    href: "/fees/defaulters",
    title: "Fee defaulter report",
    copy: "Exportable follow-up queue with aging and WhatsApp reminders.",
    action: "Open queue"
  },
  {
    href: "/notifications",
    title: "WhatsApp delivery log",
    copy: "Auditable parent-message history for receipts, alerts, and notices.",
    action: "Open logs"
  }
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" />
      <section className="grid gap-4 md:grid-cols-3">
        {reports.map((report) => (
          <article className="rounded-2xl border border-[#DCE1E8] bg-white p-5 shadow-apple" key={report.href}>
            <h2 className="text-[17px] font-semibold text-[#0F1419]">{report.title}</h2>
            <p className="mt-2 min-h-[66px] text-[13px] leading-6 text-[#5A6573]">{report.copy}</p>
            <Link className="btn-primary mt-5 min-h-10 px-4 text-[13px]" href={report.href}>
              {report.action}
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
