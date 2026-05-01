import { KpiCard } from "@/components/ui/KpiCard";
import type { StudentDetail } from "@/lib/api";
import {
  classLabel,
  money,
  performanceTone,
  type AttendanceSummary,
  type PerformanceClassification
} from "./studentProfileUtils";

type KPISectionProps = {
  student: StudentDetail;
  attendance: AttendanceSummary;
  pendingFees: number;
  performanceClassification: PerformanceClassification;
  isPerformanceFallback: boolean;
};

export function KPISection({ student, attendance, pendingFees, performanceClassification, isPerformanceFallback }: KPISectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Class" value={classLabel(student)} />
      <KpiCard
        label="Recent attendance"
        value={attendance.total ? `${attendance.percentage}%` : "No records"}
        tone={attendance.percentage >= 75 || attendance.total === 0 ? "good" : "danger"}
      />
      <KpiCard label="Pending fees" value={money(pendingFees)} tone={pendingFees > 0 ? "warn" : "good"} />
      <KpiCard
        label={isPerformanceFallback ? "Performance fallback" : "Performance"}
        value={performanceClassification}
        tone={performanceTone(performanceClassification)}
      />
    </div>
  );
}
