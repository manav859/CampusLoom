import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";

const students = [
  ["ADM-001", "Aarav Patel", "6-A", "91%", "₹18,000"],
  ["ADM-004", "Anaya Patel", "6-A", "72%", "₹18,000"],
  ["ADM-008", "Meera Patel", "7-A", "84%", "₹24,000"],
  ["ADM-012", "Nisha Patel", "8-B", "68%", "₹24,000"]
];

export default function StudentsPage() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Students" title="Student directory" action={<button className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white">Add student</button>} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <input className="rounded-lg border border-line bg-panel px-3 py-2 sm:w-80" placeholder="Search name, admission no, phone" />
        <select className="rounded-lg border border-line bg-panel px-3 py-2"><option>All classes</option><option>6-A</option><option>7-A</option></select>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>{["Admission", "Name", "Class", "Attendance", "Pending fees", ""].map((head) => <th className="px-3 py-3" key={head}>{head}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {students.map((student) => (
              <tr key={student[0]}>
                <td className="px-3 py-3">{student[0]}</td>
                <td className="px-3 py-3 font-medium text-ink">{student[1]}</td>
                <td className="px-3 py-3">{student[2]}</td>
                <td className="px-3 py-3"><StatusPill label={student[3]} tone={Number(student[3].replace("%", "")) < 75 ? "danger" : "good"} /></td>
                <td className="px-3 py-3">{student[4]}</td>
                <td className="px-3 py-3 text-right"><Link className="font-medium text-action" href="/students/demo">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

