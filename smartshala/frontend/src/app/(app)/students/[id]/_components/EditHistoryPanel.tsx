import { formatDateTimeShort, humanizeConstant } from "@/lib/formatters";
import type { StudentDetail } from "@/lib/api";

type EditHistoryPanelProps = {
  history: StudentDetail["editHistory"];
};

const fieldLabels: Record<string, string> = {
  fullName: "Full name",
  admissionNumber: "Admission no.",
  rollNumber: "Roll no.",
  dateOfBirth: "Date of birth",
  gender: "Gender",
  classId: "Class",
  parentName: "Parent name",
  parentPhone: "Parent phone",
  alternatePhone: "Alternate phone",
  fatherName: "Father name",
  fatherPhone: "Father phone",
  fatherOccupation: "Father occupation",
  motherName: "Mother name",
  motherPhone: "Mother phone",
  motherOccupation: "Mother occupation",
  guardianName: "Guardian name",
  guardianPhone: "Guardian phone",
  guardianOccupation: "Guardian occupation",
  address: "Address",
  isActive: "Status"
};

function normalizeValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Active" : "Inactive";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return formatDateTimeShort(value).split(",")[0];
  }
  return String(value);
}

function changedFields(entry: StudentDetail["editHistory"][number]) {
  const before = entry.beforeJson ?? {};
  const after = entry.afterJson ?? {};

  return Object.keys(fieldLabels)
    .filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
    .map((key) => ({
      key,
      label: fieldLabels[key],
      before: normalizeValue(before[key]),
      after: normalizeValue(after[key])
    }));
}

export function EditHistoryPanel({ history }: EditHistoryPanelProps) {
  if (!history || history.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
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
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--ink-900)]">{entry.summary}</p>
              <p className="mt-0.5 text-[12px] font-medium text-[var(--ink-500)]">
                {entry.actor?.fullName ?? "System"} {entry.actor ? `(${humanizeConstant(entry.actor.role)})` : ""}
              </p>
              {changedFields(entry).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {changedFields(entry).slice(0, 4).map((change) => (
                    <span className="rounded-md bg-[var(--surface-50)] px-2 py-1 text-[11px] font-semibold text-[var(--ink-700)]" key={change.key}>
                      {change.label}: {change.before} {"->"} {change.after}
                    </span>
                  ))}
                </div>
              ) : null}
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
