"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PaymentModal } from "@/components/fees/PaymentModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal, ModalCloseButton } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { KpiCardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { feesApi, type PaymentResult, type StudentFeeLedger } from "@/lib/api";
import { formatDateShort, formatINR, humanizeConstant } from "@/lib/formatters";
import { cachedFetch, invalidateCache, invalidateCachePrefix } from "@/lib/prefetchCache";

// A payment or adjustment changes this student's paid/pending amounts. Drop every
// cache that reflects those numbers so other views (profile, dashboard, lists) refetch.
function invalidateStudentFeeCaches(studentId: string) {
  invalidateCache(`fees:ledger:${studentId}`);
  invalidateCache(`student:${studentId}`);
  invalidateCache("fees:dashboard");
  invalidateCache("fees:defaulters");
  invalidateCachePrefix("students:list:");
}

function statusTone(status: StudentFeeLedger["status"]) {
  if (status === "PAID") return "good";
  if (status === "PARTIAL") return "warn";
  return "danger";
}

function receiptLabel(payment: Pick<StudentFeeLedger["payments"][number], "receiptId" | "receiptNo" | "receipt">) {
  return payment.receiptNo ?? payment.receipt?.receiptNo ?? payment.receiptId ?? "Pending";
}

function paymentReference(payment: StudentFeeLedger["payments"][number]) {
  return payment.upiTransactionId ?? payment.chequeNumber ?? payment.ddNumber ?? payment.bankReference ?? payment.gatewayTransactionId ?? "-";
}

function transportFeeAmount(assignment: StudentFeeLedger["assignments"][number]) {
  return Number(assignment.transportFeeAmount ?? 0);
}

function baseFeeAmount(assignment: StudentFeeLedger["assignments"][number]) {
  return Math.max(0, Number(assignment.total ?? 0) - transportFeeAmount(assignment));
}

function feeComponentLabel(feeComponent?: StudentFeeLedger["payments"][number]["feeComponent"]) {
  return feeComponent === "TRANSPORTATION_FEE" ? "Transportation fee" : "School fee";
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
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [sendingReceiptId, setSendingReceiptId] = useState<string | null>(null);
  const [adjustmentOpen, setAdjustmentOpen] = useState<"CONCESSION" | "DISCOUNT" | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  async function loadLedger(background = false) {
    if (!background) setLoading(true);
    setError("");
    try {
      // Invalidate stale cache before reload (e.g. after payment)
      invalidateCache(`fees:ledger:${studentId}`);
      setLedger(await cachedFetch(`fees:ledger:${studentId}`, () => feesApi.studentLedger(studentId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load fee ledger");
    } finally {
      if (!background) setLoading(false);
    }
  }

  useEffect(() => {
    loadLedger();
  }, [studentId]);

  function paymentSuccess(result: PaymentResult) {
    const statusLabel = result.ledger.status === "PAID" ? "Fully Paid" : "Partial";
    setNotice(
      `Payment of ${formatINR(result.payment.amount, { compact: false })} recorded - Receipt ${result.receipt.receiptNo} - ${statusLabel}` +
      (result.ledger.balance > 0 ? ` - Balance: ${formatINR(result.ledger.balance, { compact: false })}` : "") +
      (result.receiptNotificationQueued ? " - WhatsApp receipt queued" : "")
    );
    invalidateStudentFeeCaches(studentId);
    loadLedger(true);
  }

  async function handleDownloadReceipt(receiptId: string, receiptNo: string) {
    setDownloadingId(receiptId);
    try {
      await feesApi.downloadReceiptPdf(receiptId, receiptNo);
    } catch {
      setError("Failed to download receipt PDF");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handlePreviewReceipt(receiptId: string) {
    setPreviewingId(receiptId);
    try {
      await feesApi.previewReceiptPdf(receiptId);
    } catch {
      setError("Failed to open receipt preview");
    } finally {
      setPreviewingId(null);
    }
  }

  async function handleSendReceipt(receiptId: string) {
    setSendingReceiptId(receiptId);
    setError("");
    try {
      const result = await feesApi.sendReceiptWhatsApp(receiptId);
      setNotice(`Receipt ${result.receiptNo} sent on WhatsApp to ${result.parentPhone}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send receipt on WhatsApp");
    } finally {
      setSendingReceiptId(null);
    }
  }

  function openAdjustment(type: "CONCESSION" | "DISCOUNT") {
    setAdjustmentOpen(type);
    setAdjustmentAmount("");
    setAdjustmentReason(type === "CONCESSION" ? "Approved fee concession" : "Approved fee discount");
  }

  async function submitAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ledger || !adjustmentOpen) return;
    const amount = Number(adjustmentAmount);
    if (!amount || amount <= 0 || amount > ledger.balance) {
      setError(`Adjustment amount must be between INR 1 and ${formatINR(ledger.balance, { compact: false })}.`);
      return;
    }

    setSavingAdjustment(true);
    setError("");
    setNotice("");
    try {
      const result = await feesApi.applyAdjustment({
        studentId: ledger.student.id,
        type: adjustmentOpen,
        amount,
        reason: adjustmentReason
      });
      setNotice(`${humanizeConstant(adjustmentOpen)} of ${formatINR(result.adjustment.amount, { compact: false })} applied.`);
      setAdjustmentOpen(null);
      invalidateStudentFeeCaches(ledger.student.id);
      await loadLedger();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to apply fee adjustment");
    } finally {
      setSavingAdjustment(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fee ledger"
        title={ledger?.student.fullName ?? "Student ledger"}
        action={
          <div className="flex gap-2">
            <Link className="btn-secondary" href="/fees">Back</Link>
            <button className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed" disabled={!ledger || ledger.balance <= 0} onClick={() => setPaymentOpen(true)}>
              Record Payment
            </button>
          </div>
        }
      />

      {notice ? (
        <div className="flex items-center gap-2 rounded-xl bg-[#34c759]/10 px-4 py-3 text-[13px] font-medium text-[#248a3d]">
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
          <TableSkeleton rows={3} cols={7} />
        </div>
      ) : ledger ? (
        <>
          <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Ledger Summary</h2>
                  <StatusPill label={humanizeConstant(ledger.status)} tone={statusTone(ledger.status)} />
                </div>
                <p className="mt-1 text-[13px] text-[#86868b]">
                  {ledger.student.class.name}-{ledger.student.class.section} - Admission <span className="type-code">{ledger.student.admissionNumber}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary min-h-9 px-3 text-[12px]" disabled={ledger.balance <= 0} onClick={() => openAdjustment("CONCESSION")} type="button">Issue Concession</button>
                <button className="btn-secondary min-h-9 px-3 text-[12px]" disabled={ledger.balance <= 0} onClick={() => openAdjustment("DISCOUNT")} type="button">Apply Discount</button>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["Total fees", formatINR(ledger.total), "text-[#1d1d1f]"],
                ["Due to date", formatINR(ledger.dueToDate), "text-[#1d1d1f]"],
                ["Paid", formatINR(ledger.paid), "text-[#248a3d]"],
                ["Outstanding now", formatINR(ledger.currentOutstanding), ledger.currentOutstanding > 0 ? "text-[#C8242C]" : "text-[#248a3d]"],
                ["Balance", formatINR(ledger.balance), ledger.balance > 0 ? "text-[#B95A00]" : "text-[#248a3d]"]
              ].map(([label, value, tone]) => (
                <div className="border-t border-[#DCE1E8] pt-4" key={label}>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">{label}</p>
                  <p className={`mt-2 text-[26px] font-semibold tracking-tight ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
            <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Assignments</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">{ledger.student.class.name}-{ledger.student.class.section} - Admission <span className="type-code">{ledger.student.admissionNumber}</span></p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="table-head">
                  <tr>{["Fee", "Total", "Paid", "Due now", "Balance", "Status"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                  {ledger.assignments.map((assignment) => {
                    const transportAmount = transportFeeAmount(assignment);
                    return (
                      <tr key={assignment.id} className="table-row">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-[#1d1d1f]">{assignment.feeStructure.name}</p>
                          {transportAmount > 0 ? (
                            <div className="mt-1.5 space-y-0.5 text-[11px] font-medium text-[#86868b]">
                              <p>Base fee: {formatINR(baseFeeAmount(assignment), { compact: false })}</p>
                              <p>Transportation fee: {formatINR(transportAmount, { compact: false })}</p>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-5 py-4 text-[#6e6e73]">{formatINR(assignment.total)}</td>
                        <td className="px-5 py-4 text-[#6e6e73]">{formatINR(assignment.paid)}</td>
                        <td className={`px-5 py-4 font-semibold ${assignment.currentOutstanding > 0 ? "text-[#C8242C]" : "text-[#248a3d]"}`}>{formatINR(assignment.currentOutstanding)}</td>
                        <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{formatINR(assignment.balance)}</td>
                        <td className="px-5 py-4">
                          <StatusPill label={humanizeConstant(assignment.status)} tone={statusTone(assignment.status)} />
                          {assignment.status === "PARTIAL" ? (
                            <p className="mt-1.5 text-[11px] font-medium text-[#86868b]">Paid {formatINR(assignment.paid, { compact: false })} of {formatINR(assignment.total, { compact: false })} - {formatINR(assignment.balance, { compact: false })} pending</p>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {ledger.adjustments.length > 0 ? (
            <section className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
              <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Concessions and Discounts</h2>
                <p className="mt-0.5 text-[13px] text-[#86868b]">Approved fee reductions are preserved with reason and recorder.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead className="table-head">
                    <tr>{["Date", "Type", "Amount", "Fee", "Reason", "Recorded by"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                    {ledger.adjustments.map((adjustment) => (
                      <tr className="table-row" key={adjustment.id}>
                        <td className="px-5 py-4 text-[#6e6e73]">{formatDateShort(adjustment.createdAt)}</td>
                        <td className="px-5 py-4"><StatusPill label={humanizeConstant(adjustment.type)} tone="warn" /></td>
                        <td className="px-5 py-4 font-semibold text-[#B95A00]">{formatINR(adjustment.amount)}</td>
                        <td className="px-5 py-4 text-[#6e6e73]">{adjustment.feeStructureName}</td>
                        <td className="px-5 py-4 text-[#6e6e73]">{adjustment.reason}</td>
                        <td className="px-5 py-4 text-[#6e6e73]">{adjustment.recordedBy?.fullName ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {ledger.payments.length === 0 ? (
            <EmptyState
              headline="No fee payments recorded"
              description="Record the first payment to generate receipts, update running balance, and notify the parent on WhatsApp."
              action={
                <button className="btn-primary min-h-10 px-4 text-[13px]" disabled={ledger.balance <= 0} onClick={() => setPaymentOpen(true)} type="button">
                  Record payment
                </button>
              }
            />
          ) : (
          <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
              <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Transaction Ledger</h2>
                <p className="mt-0.5 text-[13px] text-[#86868b]">Every payment is posted with its running balance.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-left text-[13px]">
                  <thead className="table-head">
                    <tr>{["Date", "Amount", "Mode", "Reference", "Receipt ID", "Balance After", "Fee", "Actions"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                    {ledger.payments.length === 0 ? (
                      <tr><td className="px-5 py-12 text-center text-[#86868b]" colSpan={8}>No payments recorded yet.</td></tr>
                    ) : (
                      ledger.payments.map((payment) => {
                        const receiptId = payment.receiptId ?? payment.receipt?.id ?? null;
                        return (
                          <tr key={payment.id} className="table-row">
                            <td className="px-5 py-4 text-[#6e6e73]">{formatDateShort(payment.date ?? payment.paidAt)}</td>
                            <td className="px-5 py-4">
                              <p className="font-semibold text-[#248a3d]">{formatINR(payment.amount)}</p>
                              <p className="mt-1 text-[11px] font-medium text-[#86868b]">{feeComponentLabel(payment.feeComponent)}</p>
                            </td>
                            <td className="px-5 py-4 text-[#6e6e73]">{humanizeConstant(payment.mode)}</td>
                            <td className="px-5 py-4 text-[#6e6e73]">{paymentReference(payment)}</td>
                            <td className="px-5 py-4 type-code text-[#6e6e73]">{receiptLabel(payment)}</td>
                            <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{formatINR(payment.balanceAfter)}</td>
                            <td className="px-5 py-4 text-[#6e6e73]">{payment.feeStructureName ?? "Fee"}</td>
                            <td className="px-5 py-4">
                              {receiptId ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => handlePreviewReceipt(receiptId)}
                                    disabled={previewingId === receiptId}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2557]/10 px-3 py-1.5 text-[11px] font-bold text-[#0f2557] transition-colors hover:bg-[#0f2557] hover:text-white disabled:opacity-50"
                                  >
                                    {previewingId === receiptId ? "Opening..." : "Preview"}
                                  </button>
                                  <button
                                    onClick={() => handleDownloadReceipt(receiptId, receiptLabel(payment))}
                                    disabled={downloadingId === receiptId}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0071e3]/10 px-3 py-1.5 text-[11px] font-bold text-[#0071e3] transition-colors hover:bg-[#0071e3] hover:text-white disabled:opacity-50"
                                  >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                    {downloadingId === receiptId ? "..." : "PDF"}
                                  </button>
                                  <button
                                    onClick={() => handleSendReceipt(receiptId)}
                                    disabled={sendingReceiptId === receiptId}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366]/10 px-3 py-1.5 text-[11px] font-bold text-[#128C7E] transition-colors hover:bg-[#25D366] hover:text-white disabled:opacity-50"
                                  >
                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                                    </svg>
                                    {sendingReceiptId === receiptId ? "Sending..." : "WhatsApp"}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[#86868b]">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple">
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Payment Timeline</h2>
              <div className="mt-5 space-y-5">
                {ledger.transactionLedger.length === 0 ? (
                  <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4 text-[13px] font-medium text-[#86868b]">No payments posted yet.</div>
                ) : (
                  ledger.transactionLedger.map((payment, index) => (
                    <div className="relative pl-7" key={payment.id}>
                      <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-[#34c759] ring-4 ring-[#34c759]/15" />
                      {index < ledger.transactionLedger.length - 1 ? <span className="absolute bottom-[-22px] left-[5px] top-5 w-px bg-[rgba(0,0,0,0.08)]" /> : null}
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">{formatINR(payment.amount)} posted</p>
                      <p className="mt-1 text-[12px] text-[#86868b]">{formatDateShort(payment.date)} - {humanizeConstant(payment.mode)} - {feeComponentLabel(payment.feeComponent)} - {payment.feeStructureName}</p>
                      <p className="mt-1 text-[12px] font-semibold text-[#6e6e73]">Balance after: {formatINR(payment.balanceAfter)}</p>
                    </div>
                  ))
                )}
              </div>
            </aside>
          </section>
          )}

          <PaymentModal
            maxAmount={ledger.balance}
            onClose={() => setPaymentOpen(false)}
            onSuccess={paymentSuccess}
            open={paymentOpen}
            studentId={ledger.student.id}
            studentName={ledger.student.fullName}
          />

          <Modal
            isOpen={Boolean(adjustmentOpen)}
            onClose={() => setAdjustmentOpen(null)}
            title={adjustmentOpen === "CONCESSION" ? "Issue concession" : "Apply discount"}
            description={`This reduces pending fees for ${ledger.student.fullName}. The change is recorded in ledger history.`}
            footer={
              <>
                <ModalCloseButton onClick={() => setAdjustmentOpen(null)} />
                <Button form="fee-adjustment-form" isLoading={savingAdjustment} type="submit">
                  Save adjustment
                </Button>
              </>
            }
          >
            <form className="space-y-4" id="fee-adjustment-form" onSubmit={submitAdjustment}>
              <label className="block">
                <span className="text-[13px] font-semibold text-[#1d1d1f]">Amount</span>
                <input
                  className="glass-input mt-2"
                  max={ledger.balance}
                  min={1}
                  onChange={(event) => setAdjustmentAmount(event.target.value)}
                  type="number"
                  value={adjustmentAmount}
                />
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold text-[#1d1d1f]">Reason</span>
                <textarea
                  className="glass-input mt-2 min-h-[92px] resize-none py-3"
                  onChange={(event) => setAdjustmentReason(event.target.value)}
                  value={adjustmentReason}
                />
              </label>
            </form>
          </Modal>
        </>
      ) : null}
    </div>
  );
}

