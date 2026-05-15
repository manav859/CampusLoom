import { formatDateTimeShort, humanizeConstant } from "@/lib/formatters";
import type { StudentDetail } from "@/lib/api";

type EditHistoryPanelProps = {
  history: StudentDetail["editHistory"];
};

export function EditHistoryPanel({ history }: EditHistoryPanelProps) {
  if (!history || history.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[var(--border-200)] bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ink-900)]">Edit history</h2>
          <p className="text-[12px] font-medium text-[var(--ink-500)]">Latest immutable record changes for this student.</p>
        </div>
        <span className="text-[12px] font-semibold text-[var(--ink-500)]">{history.length} events</span>
      </div>

      <div className="mt-4 divide-y divide-[var(--border-200)]">
        {history.slice(0, 5).map((entry) => (
          <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={entry.id}>
            <div>
              <p className="text-[13px] font-semibold text-[var(--ink-900)]">{entry.summary}</p>
              <p className="mt-0.5 text-[12px] font-medium text-[var(--ink-500)]">
                {entry.actor?.fullName ?? "System"} {entry.actor ? `(${humanizeConstant(entry.actor.role)})` : ""}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="inline-flex rounded-md bg-[var(--surface-50)] px-2 py-1 text-[11px] font-semibold text-[var(--ink-500)]">
                {humanizeConstant(entry.action)}
              </span>
              <p className="mt-1 text-[12px] font-medium text-[var(--ink-500)]">{formatDateTimeShort(entry.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
