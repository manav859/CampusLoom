import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

const reports = [
  {
    href: "/reports/daily-attendance",
    title: "Daily attendance report",
    copy: "Printable attendance scope, pending classes, marked-only averages, and CSV export.",
    action: "Open report"
  },
  {
    href: "/reports/student-performance",
    title: "Student performance report",
    copy: "Attendance, performance classification, fee balance, and student profile actions.",
    action: "Open report"
  },
  {
    href: "/reports/subject-wise",
    title: "Subject wise report",
    copy: "Student performance split by subject with averages, best score, pending exams, and CSV export.",
    action: "Open report"
  },
  {
    href: "/reports/teacher-performance",
    title: "Teacher performance",
    copy: "Teacher workload, class ownership, attendance completion, and active status.",
    action: "Open report"
  },
  {
    href: "/reports/exams",
    title: "Exam reports",
    copy: "Filterable student exam reports, exportable to CSV and PDF across classes and subjects.",
    action: "Open report"
  }
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader hideBreadcrumbs title="Printable and exportable reports" />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
