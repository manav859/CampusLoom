"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { feesApi, studentsApi, type FeeDefaulter, whatsappApi } from "@/lib/api";

function money(value: number) {
  return `Rs ${Number(value ?? 0).toLocaleString("en-IN")}`;
}

export default function DefaultersPage() {
  const [rows, setRows] = useState<FeeDefaulter[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    feesApi.defaulters()
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load defaulters");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function sendReminder(row: FeeDefaulter) {
    setSendingId(row.studentId);
    setError("");
    setNotice("");
    try {
      const student = await studentsApi.get(row.studentId);
      await whatsappApi.send({
        phone: student.parentPhone,
        message: `Dear Parent, fee balance of Rs ${row.balance.toLocaleString("en-IN")} for ${row.name} is pending. Please clear it at the earliest.`
      });
      setNotice(`WhatsApp reminder sent to ${row.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reminder");
    } finally {
      setSendingId("");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Fees" title="Defaulter follow-up queue" action={<Link className="btn-secondary" href="/fees">← Back to fees</Link>} />

      {notice ? <div className="rounded-xl bg-[#34c759]/10 px-4 py-3 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}
      {error ? <div className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="table-head">
              <tr>{["Student", "Class", "Balance", "Days overdue", "Status", "Action"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
              ) : rows.length === 0 ? (
                <tr><td className="px-5 py-12 text-center text-[#86868b]" colSpan={6}>No defaulters found.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.studentId}-${row.balance}`} className="table-row">
                    <td className="px-5 py-4">
                      <Link className="font-semibold text-[#1d1d1f] transition-colors duration-200 hover:text-[#0071e3]" href={`/fees/${row.studentId}`}>{row.name}</Link>
                    </td>
                    <td className="px-5 py-4 text-[#6e6e73]">{row.class}</td>
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{money(row.balance)}</td>
                    <td className="px-5 py-4">
                      <StatusPill label={`${row.daysOverdue} days`} tone={row.daysOverdue > 0 ? "danger" : "warn"} />
                    </td>
                    <td className="px-5 py-4"><StatusPill label={row.status} tone={row.status === "PARTIAL" ? "warn" : "danger"} /></td>
                    <td className="px-5 py-4">
                      <button
                        className="btn-primary min-h-[36px] px-4 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        disabled={sendingId === row.studentId}
                        onClick={() => sendReminder(row)}
                      >
                        {sendingId === row.studentId ? "Sending…" : "Send WhatsApp"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
