import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { StatusPill } from "@/components/ui/StatusPill";

export default function AnalyticsPage() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="AI analytics" title="Attendance and fee risk insights" />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Below 75%" value="8" tone="danger" />
        <KpiCard label="Combined risk" value="3" tone="danger" />
        <KpiCard label="Repeat absentees" value="5" tone="warn" />
      </div>
      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="font-semibold">Class performance</h2>
          <div className="mt-4"><SimpleBarChart items={[{ label: "6-A", value: 91 }, { label: "7-A", value: 84 }, { label: "8-B", value: 71 }]} /></div>
        </div>
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="font-semibold">Priority students</h2>
          <div className="mt-4 space-y-2">
            {[
              ["Aarav Patel", "Low attendance + pending fees", "HIGH"],
              ["Nisha Patel", "Absent 4 times this month", "MEDIUM"],
              ["Meera Patel", "Fee overdue", "MEDIUM"]
            ].map(([name, reason, severity]) => (
              <div key={name} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <div><p className="font-medium">{name}</p><p className="text-sm text-neutral-500">{reason}</p></div>
                <StatusPill label={severity} tone={severity === "HIGH" ? "danger" : "warn"} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

