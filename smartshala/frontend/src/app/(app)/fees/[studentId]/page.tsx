"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FeeCard } from "@/components/fees/FeeCard";
import { PaymentModal } from "@/components/fees/PaymentModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { KpiCardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { feesApi, type StudentFeeLedger, type PaymentResult } from "@/lib/api";

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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  function paymentSuccess(result: PaymentResult) {
    const statusLabel = result.ledger.status === "PAID" ? "Fully Paid" : "Partial";
    setNotice(
      `Payment of Rs ${Number(result.payment.amount).toLocaleString("en-IN")} recorded · Receipt ${result.receipt.receiptNo} · ${statusLabel}` +
      (result.ledger.balance > 0 ? ` · Balance: Rs ${result.ledger.balance.toLocaleString("en-IN")}` : "") +
      ` · WhatsApp receipt queued`
    );
    loadLedger();
  }

  async function handleDownloadReceipt(receiptId: string) {
    setDownloadingId(receiptId);
    try {
      await feesApi.downloadReceiptPdf(receiptId);
    } catch {
      setError("Failed to download receipt PDF");
    } finally {
      setDownloadingId(null);
    }
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

      {notice ? (
        <div className="rounded-xl bg-[#34c759]/10 px-4 py-3 text-[13px] font-medium text-[#248a3d] flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          {notice}
        </div>
      ) : null}
      {error ? <div className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
          </div>
          <TableSkeleton rows={3} cols={5} />
          <TableSkeleton rows={3} cols={5} />
        </div>
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
              <table className="w-full min-w-[800px] text-left text-[13px]">
                <thead className="table-head">
                  <tr>{["Amount", "Mode", "Receipt No", "Date", "Fee", "Receipt"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                  {ledger.payments.length === 0 ? (
                    <tr><td className="px-5 py-12 text-center text-[#86868b]" colSpan={6}>No payments recorded yet.</td></tr>
                  ) : (
                    ledger.payments.map((payment) => {
                      const receiptId = payment.receipt?.id;
                      return (
                        <tr key={payment.id} className="table-row">
                          <td className="px-5 py-4 font-semibold text-[#248a3d]">{money(payment.amount)}</td>
                          <td className="px-5 py-4 text-[#6e6e73]">{payment.mode}</td>
                          <td className="px-5 py-4 text-[#6e6e73] font-medium">{payment.receiptNo ?? payment.receipt?.receiptNo ?? "Pending"}</td>
                          <td className="px-5 py-4 text-[#6e6e73]">{formatDate(payment.paidAt)}</td>
                          <td className="px-5 py-4 text-[#6e6e73]">{payment.feeStructureName ?? "Fee"}</td>
                          <td className="px-5 py-4">
                            {receiptId ? (
                              <button
                                onClick={() => handleDownloadReceipt(receiptId)}
                                disabled={downloadingId === receiptId}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0071e3]/10 px-3 py-1.5 text-[11px] font-bold text-[#0071e3] hover:bg-[#0071e3] hover:text-white transition-colors disabled:opacity-50"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                {downloadingId === receiptId ? "…" : "PDF"}
                              </button>
                            ) : (
                              <span className="text-[11px] text-[#86868b]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
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
