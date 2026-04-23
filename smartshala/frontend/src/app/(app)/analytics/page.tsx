import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { StatusPill } from "@/components/ui/StatusPill";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="AI analytics" title="Attendance and fee risk insights" />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Below 75%" value="8" tone="danger" />
        <KpiCard label="Combined risk" value="3" tone="danger" />
        <KpiCard label="Repeat absentees" value="5" tone="warn" />
      </div>
      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-card-interactive p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Class performance</h2>
          <div className="mt-5"><SimpleBarChart items={[{ label: "6-A", value: 91 }, { label: "7-A", value: 84 }, { label: "8-B", value: 71 }]} /></div>
        </div>
        <div className="glass-card-interactive p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Priority students</h2>
          <div className="mt-5 space-y-2">
            {[
              ["Aarav Patel", "Low attendance + pending fees", "HIGH"],
              ["Nisha Patel", "Absent 4 times this month", "MEDIUM"],
              ["Meera Patel", "Fee overdue", "MEDIUM"]
            ].map(([name, reason, severity]) => (
              <div key={name} className="flex items-center justify-between gap-3 rounded-xl bg-[rgba(0,0,0,0.02)] px-4 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">{name}</p>
                  <p className="text-[12px] text-[#86868b]">{reason}</p>
                </div>
                <StatusPill label={severity} tone={severity === "HIGH" ? "danger" : "warn"} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
