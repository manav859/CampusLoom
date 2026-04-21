import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";

const classes = [
  ["6-A", "Anita Sharma", 28, "Marked"],
  ["7-A", "Anita Sharma", 30, "Marked"],
  ["8-B", "Rahul Mehta", 29, "Pending"]
];

export default function ClassesPage() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Classes" title="Classes and assignments" action={<button className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white">Create class</button>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map(([name, teacher, count, status]) => (
          <div key={String(name)} className="rounded-lg border border-line bg-panel p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{name}</h2>
              <StatusPill label={String(status)} tone={status === "Marked" ? "good" : "warn"} />
            </div>
            <p className="mt-3 text-sm text-neutral-600">Class teacher: {teacher}</p>
            <p className="mt-1 text-sm text-neutral-600">{count} active students</p>
          </div>
        ))}
      </div>
    </div>
  );
}

