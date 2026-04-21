"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";

import { apiFetch } from "@/lib/api";

type Status = "PRESENT" | "ABSENT" | "LATE";
type Student = { id: string; rollNumber: number; fullName: string; status: Status };

const demoStudents: Student[] = Array.from({ length: 28 }).map((_, index) => ({
  id: `student-${index + 1}`,
  rollNumber: index + 1,
  fullName: ["Aarav", "Diya", "Vivaan", "Anaya", "Ishaan", "Sara", "Kabir"][index % 7] + ` ${index + 1}`,
  status: "PRESENT"
}));

export function AttendanceMarkClient() {
  const [students, setStudents] = useState(demoStudents);
  const [classes, setClasses] = useState<{ id: string; name: string; section: string }[]>([]);
  const [className, setClassName] = useState("");

  useEffect(() => {
    apiFetch<{ id: string; name: string; section: string }[]>("/classes")
      .then((data) => {
        setClasses(data || []);
        if (data && data.length > 0 && !className) {
          setClassName(`${data[0].name}-${data[0].section}`);
        }
      })
      .catch(console.error);
  }, []);

  const counts = useMemo(
    () => ({
      present: students.filter((student) => student.status === "PRESENT").length,
      absent: students.filter((student) => student.status === "ABSENT").length,
      late: students.filter((student) => student.status === "LATE").length
    }),
    [students]
  );

  function setStatus(id: string, status: Status) {
    setStudents((items) => items.map((student) => (student.id === id ? { ...student, status } : student)));
  }

  function markAllPresent() {
    setStudents((items) => items.map((student) => ({ ...student, status: "PRESENT" })));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Attendance"
        title="Tap absent students, then submit"
        action={<button className="rounded-lg border border-line px-4 py-2 text-sm font-semibold" onClick={markAllPresent}>Reset all present</button>}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <select className="rounded-lg border border-line bg-panel px-3 py-2" value={className} onChange={(event) => setClassName(event.target.value)}>
          {classes.map((cls) => (
            <option key={cls.id} value={`${cls.name}-${cls.section}`}>{cls.name}-{cls.section}</option>
          ))}
        </select>
        <input className="rounded-lg border border-line bg-panel px-3 py-2" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        <div className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">Present: {counts.present}</div>
        <div className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">Absent: {counts.absent}</div>
      </div>

      <div className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="grid grid-cols-[56px_1fr_96px] gap-2 border-b border-line px-3 py-2 text-xs font-semibold uppercase text-neutral-500">
          <span>Roll</span>
          <span>Student</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-line">
          {students.map((student) => (
            <div key={student.id} className="grid grid-cols-[56px_1fr] gap-2 px-3 py-3 sm:grid-cols-[56px_1fr_260px] sm:items-center">
              <span className="text-sm text-neutral-500">{student.rollNumber}</span>
              <div>
                <p className="font-medium text-ink">{student.fullName}</p>
                <div className="mt-1 sm:hidden">
                  <StatusPill label={student.status} tone={student.status === "ABSENT" ? "danger" : student.status === "LATE" ? "warn" : "good"} />
                </div>
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-2 sm:col-span-1">
                {(["PRESENT", "ABSENT", "LATE"] as Status[]).map((status) => (
                  <button
                    key={status}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                      student.status === status ? "border-action bg-action text-white" : "border-line bg-white text-neutral-700"
                    }`}
                    onClick={() => setStatus(student.id, status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 rounded-lg border border-line bg-panel p-3 shadow-soft">
        <button className="w-full rounded-lg bg-action px-4 py-3 font-semibold text-white">
          Submit {className} attendance
        </button>
      </div>
    </div>
  );
}

