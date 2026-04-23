"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FeeCard } from "@/components/fees/FeeCard";
import { PaymentModal } from "@/components/fees/PaymentModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { feesApi, type StudentFeeLedger } from "@/lib/api";

function money(value: string | number) {
  return `Rs ${Number(value ?? 0).toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function statusTone(status: StudentFeeLedger["status"]) {
  if (status === "PAID") return "good";
  if (status === "PARTIAL") return "warn";
  return "danger";
}

export default function StudentFeeLedgerPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  const [ledger, setLedger] = useState<StudentFeeLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);

  async function loadLedger() {
    setLoading(true);
    setError("");
    try {
      setLedger(await feesApi.studentLedger(studentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load fee ledger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLedger();
  }, [studentId]);

  function paymentSuccess() {
    setNotice("Payment recorded and WhatsApp receipt queued.");
    loadLedger();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fee ledger"
        title={ledger?.student.fullName ?? "Student ledger"}
        action={
          <div className="flex gap-2">
            <Link className="btn-secondary" href="/fees">← Back</Link>
            <button className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed" disabled={!ledger || ledger.balance <= 0} onClick={() => setPaymentOpen(true)}>
              Record Payment
            </button>
          </div>
        }
      />

      {notice ? <div className="rounded-xl bg-[#34c759]/10 px-4 py-3 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}
      {error ? <div className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}

      {loading ? (
        <div className="rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] px-4 py-12 text-center text-[#86868b] text-[13px] shadow-apple-sm">Loading ledger…</div>
      ) : ledger ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeeCard label="Total fees" value={money(ledger.total)} />
            <FeeCard label="Paid" value={money(ledger.paid)} tone="good" />
            <FeeCard label="Balance" value={money(ledger.balance)} tone={ledger.balance > 0 ? "warn" : "good"} />
            <FeeCard label="Status" value={ledger.status} tone={statusTone(ledger.status)} />
          </div>

          <section className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
            <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Assignments</h2>
              <p className="text-[13px] text-[#86868b] mt-0.5">{ledger.student.class.name}-{ledger.student.class.section} · Admission {ledger.student.admissionNumber}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="table-head">
                  <tr>{["Fee", "Total", "Paid", "Balance", "Status"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                  {ledger.assignments.map((assignment) => (
                    <tr key={assignment.id} className="table-row">
                      <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{assignment.feeStructure.name}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{money(assignment.total)}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{money(assignment.paid)}</td>
                      <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{money(assignment.balance)}</td>
                      <td className="px-5 py-4"><StatusPill label={assignment.status} tone={statusTone(assignment.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
            <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Payment history</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="table-head">
                  <tr>{["Amount", "Mode", "Receipt No", "Date", "Fee"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                  {ledger.payments.length === 0 ? (
                    <tr><td className="px-5 py-12 text-center text-[#86868b]" colSpan={5}>No payments recorded yet.</td></tr>
                  ) : (
                    ledger.payments.map((payment) => (
                      <tr key={payment.id} className="table-row">
                        <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{money(payment.amount)}</td>
                        <td className="px-5 py-4 text-[#6e6e73]">{payment.mode}</td>
                        <td className="px-5 py-4 text-[#6e6e73]">{payment.receiptNo ?? "Pending"}</td>
                        <td className="px-5 py-4 text-[#6e6e73]">{formatDate(payment.paidAt)}</td>
                        <td className="px-5 py-4 text-[#6e6e73]">{payment.feeStructureName ?? "Fee"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <PaymentModal
            maxAmount={ledger.balance}
            onClose={() => setPaymentOpen(false)}
            onSuccess={paymentSuccess}
            open={paymentOpen}
            studentId={ledger.student.id}
            studentName={ledger.student.fullName}
          />
        </>
      ) : null}
    </div>
  );
}
