"use client";

import { useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { feesApi, type StudentDetail } from "@/lib/api";
import { formatDateShort, humanizeConstant } from "@/lib/formatters";
import { money } from "./studentProfileUtils";

export type FeesTabPanelProps = {
  student: StudentDetail;
};

function buildTransactionLedger(student: StudentDetail) {
  const total = student.feeAssignments.reduce((sum, assignment) => sum + Number(assignment.totalAmount ?? 0), 0);
  const payments = student.feeAssignments
    .flatMap((assignment) =>
      assignment.payments.map((payment) => ({
        id: payment.id,
        date: payment.paidAt,
        amount: Number(payment.amount ?? 0),
        feeComponent: payment.feeComponent ?? "SCHOOL_FEE",
        mode: payment.mode,
        upiTransactionId: payment.upiTransactionId ?? null,
        chequeNumber: payment.chequeNumber ?? null,
        ddNumber: payment.ddNumber ?? null,
        gatewayTransactionId: payment.gatewayTransactionId ?? null,
        bankReference: payment.bankReference ?? null,
        receiptId: payment.receipt?.id ?? null,
        receiptNo: payment.receipt?.receiptNo ?? null,
        feeStructureName: assignment.feeStructure.name
      }))
    )
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime() || left.id.localeCompare(right.id));

  let runningBalance = total;
  return payments.map((payment) => {
    runningBalance = Math.max(0, Math.round((runningBalance - payment.amount) * 100) / 100);
    return { ...payment, balanceAfter: runningBalance };
  });
}

function paymentReference(payment: ReturnType<typeof buildTransactionLedger>[number]) {
  return payment.upiTransactionId ?? payment.chequeNumber ?? payment.ddNumber ?? payment.bankReference ?? payment.gatewayTransactionId ?? "-";
}

function receiptLabel(payment: ReturnType<typeof buildTransactionLedger>[number]) {
  return payment.receiptNo ?? payment.receiptId ?? "Pending";
}

function baseFeeAmount(assignment: StudentDetail["feeAssignments"][number]) {
  return Math.max(0, Number(assignment.totalAmount ?? 0) - Number(assignment.transportFeeAmount ?? 0));
}

export default function FeesTabPanel({ student }: FeesTabPanelProps) {
  const transactionLedger = buildTransactionLedger(student);
  const recentTransactions = [...transactionLedger].reverse();
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function handlePreviewReceipt(receiptId: string) {
    setPreviewingId(receiptId);
    setError("");
    try {
      await feesApi.previewReceiptPdf(receiptId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open receipt preview");
    } finally {
      setPreviewingId(null);
    }
  }

  async function handleSendReceipt(receiptId: string) {
    setSendingId(receiptId);
    setError("");
    try {
      const result = await feesApi.sendReceiptWhatsApp(receiptId);
      setNotice(`Receipt ${result.receiptNo} sent on WhatsApp to ${result.parentPhone}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send receipt on WhatsApp");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <section className="space-y-4">
      {notice ? (
        <div className="rounded-[6px] border border-[#0F8A4A]/20 bg-[#E1F5EA] px-4 py-3 text-[13px] font-medium text-[#128C7E]">{notice}</div>
      ) : null}
      {error ? (
        <div className="rounded-[6px] border border-[#FCE3E5] bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div>
      ) : null}

      <section className="overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
        <div className="border-b border-[#E7EBF0] px-5 py-4">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Fee assignments</h2>
        </div>
        <div className="space-y-3 p-4 md:hidden">
          {student.feeAssignments.length === 0 ? (
            <div className="rounded-[6px] bg-[#F7F8FB] p-4 text-[13px] font-medium text-[#86868b]">No fee assignments found.</div>
          ) : (
            student.feeAssignments.map((assignment) => (
              <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_8px_22px_-18px_rgba(15,20,25,0.35)]" key={`mobile-fee-${assignment.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold text-[#0F1419]">{assignment.feeStructure.name}</h3>
                    {Number(assignment.transportFeeAmount ?? 0) > 0 ? <p className="mt-1 text-[12px] font-medium text-[#2456E6]">Transport: {money(assignment.transportFeeAmount ?? 0)}</p> : null}
                  </div>
                  <StatusPill label={assignment.status} tone={assignment.status === "PAID" ? "good" : assignment.status === "PARTIAL" ? "warn" : "danger"} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                  <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Paid</p><p className="mt-1 font-bold text-[#0F1419]">{money(assignment.paidAmount)}</p></div>
                  <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Pending</p><p className="mt-1 font-bold text-[#0F1419]">{money(assignment.pendingAmount)}</p></div>
                  <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Total</p><p className="mt-1 font-bold text-[#0F1419]">{money(assignment.totalAmount)}</p></div>
                  <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Base fee</p><p className="mt-1 font-bold text-[#0F1419]">{money(baseFeeAmount(assignment))}</p></div>
                </div>
                {assignment.status === "PARTIAL" ? (
                  <p className="mt-3 text-[11px] font-medium text-[#86868b]">Paid {money(assignment.paidAmount)} of {money(assignment.totalAmount)} - {money(assignment.pendingAmount)} pending</p>
                ) : null}
              </article>
            ))
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] border-collapse bg-white text-center text-[14px] text-[#001B33]">
            <thead>
              <tr className="table-head-row">
                {["Fee", "Paid", "Pending", "Status"].map((head) => (
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center text-[14px] font-semibold text-[#031526]" key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {student.feeAssignments.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-[#86868b]" colSpan={4}>No fee assignments found.</td>
                </tr>
              ) : (
                student.feeAssignments.map((assignment) => (
                  <tr key={assignment.id} className="transition-colors duration-200 hover:bg-[#F8FBFD]">
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                      <p className="font-semibold text-[#1d1d1f]">{assignment.feeStructure.name}</p>
                      {Number(assignment.transportFeeAmount ?? 0) > 0 ? (
                        <div className="mt-1.5 space-y-0.5 text-[11px] font-medium text-[#6e6e73]">
                          <p>Base fee: {money(baseFeeAmount(assignment))}</p>
                          <p className="text-[#2456E6]">Transportation fee: {money(assignment.transportFeeAmount ?? 0)}</p>
                        </div>
                      ) : null}
                    </td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{money(assignment.paidAmount)}</td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{money(assignment.pendingAmount)}</td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                      <StatusPill
                        label={assignment.status}
                        tone={assignment.status === "PAID" ? "good" : assignment.status === "PARTIAL" ? "warn" : "danger"}
                      />
                      {assignment.status === "PARTIAL" ? (
                        <p className="mt-1.5 text-[11px] font-medium text-[#86868b]">Paid {money(assignment.paidAmount)} of {money(assignment.totalAmount)} — {money(assignment.pendingAmount)} pending</p>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
          <div className="border-b border-[#E7EBF0] px-5 py-4">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Transaction ledger</h2>
            <p className="mt-0.5 text-[13px] text-[#86868b]">Running balance is recalculated from posted payments.</p>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {recentTransactions.length === 0 ? (
              <div className="rounded-[6px] bg-[#F7F8FB] p-4 text-[13px] font-medium text-[#86868b]">No payments recorded yet.</div>
            ) : (
              recentTransactions.map((payment) => (
                <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_8px_22px_-18px_rgba(15,20,25,0.35)]" key={`mobile-payment-${payment.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-[#0F8A4A]">{money(payment.amount)}</p>
                      <p className="mt-1 truncate text-[12px] font-medium text-[#5A6573]">{payment.feeStructureName}</p>
                    </div>
                    <span className="rounded-[6px] bg-[#E1F5EA] px-2 py-1 text-right text-[11px] font-bold text-[#0F8A4A]">{payment.feeComponent === "TRANSPORTATION_FEE" ? "Transport" : "School fee"}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                    <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Date</p><p className="mt-1 font-bold text-[#0F1419]">{formatDateShort(payment.date)}</p></div>
                    <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Mode</p><p className="mt-1 truncate font-bold text-[#0F1419]">{humanizeConstant(payment.mode)}</p></div>
                    <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Reference</p><p className="mt-1 truncate font-bold text-[#0F1419]">{paymentReference(payment)}</p></div>
                    <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Receipt ID</p><p className="mt-1 truncate font-bold text-[#0F1419]">{receiptLabel(payment)}</p></div>
                    <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Balance after</p><p className="mt-1 font-bold text-[#0F1419]">{money(payment.balanceAfter)}</p></div>
                    <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Fee</p><p className="mt-1 truncate font-bold text-[#0F1419]">{payment.feeStructureName}</p></div>
                  </div>
                  {payment.receiptId ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        className="rounded-[6px] bg-[#0F2557]/10 px-3 py-2 text-[12px] font-bold text-[#0F2557] transition-colors hover:bg-[#0F2557] hover:text-white disabled:opacity-50"
                        disabled={previewingId === payment.receiptId}
                        onClick={() => handlePreviewReceipt(payment.receiptId!)}
                        type="button"
                      >
                        {previewingId === payment.receiptId ? "Opening..." : "Preview PDF"}
                      </button>
                      <button
                        className="rounded-[6px] bg-[#25D366]/10 px-3 py-2 text-[12px] font-bold text-[#128C7E] transition-colors hover:bg-[#25D366] hover:text-white disabled:opacity-50"
                        disabled={sendingId === payment.receiptId}
                        onClick={() => handleSendReceipt(payment.receiptId!)}
                        type="button"
                      >
                        {sendingId === payment.receiptId ? "Sending..." : "WhatsApp"}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] border-collapse bg-white text-center text-[14px] text-[#001B33]">
              <thead>
                <tr className="table-head-row">{["Date", "Amount", "Mode", "Reference", "Receipt ID", "Balance After", "Fee", "Actions"].map((head) => <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center text-[14px] font-semibold text-[#031526]" key={head}>{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {recentTransactions.length === 0 ? (
                  <tr><td className="px-5 py-12 text-center text-[#86868b]" colSpan={8}>No payments recorded yet.</td></tr>
                ) : (
                  recentTransactions.map((payment) => {
                    const receiptId = payment.receiptId;
                    return (
                      <tr key={payment.id} className="transition-colors duration-200 hover:bg-[#F8FBFD]">
                        <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{formatDateShort(payment.date)}</td>
                        <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                          <p className="font-semibold text-[#248a3d]">{money(payment.amount)}</p>
                          <p className="mt-1 text-[11px] font-semibold text-[#6e6e73]">{payment.feeComponent === "TRANSPORTATION_FEE" ? "Transportation fee" : "School fee"}</p>
                        </td>
                        <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{humanizeConstant(payment.mode)}</td>
                        <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{paymentReference(payment)}</td>
                        <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                          {receiptId ? (
                            <button
                              className="type-code text-[#2456E6] underline-offset-2 hover:underline disabled:opacity-50"
                              disabled={previewingId === receiptId}
                              onClick={() => handlePreviewReceipt(receiptId)}
                              type="button"
                            >
                              {receiptLabel(payment)}
                            </button>
                          ) : (
                            <span className="text-[#86868b]">Pending</span>
                          )}
                        </td>
                        <td className="border-b border-[#C9D3DE] px-4 py-4 text-center font-semibold text-[#1d1d1f]">{money(payment.balanceAfter)}</td>
                        <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{payment.feeStructureName}</td>
                        <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                          {receiptId ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="rounded-lg bg-[#0F2557]/10 px-3 py-1.5 text-[11px] font-bold text-[#0F2557] transition-colors hover:bg-[#0F2557] hover:text-white disabled:opacity-50"
                                disabled={previewingId === receiptId}
                                onClick={() => handlePreviewReceipt(receiptId)}
                                type="button"
                              >
                                {previewingId === receiptId ? "Opening..." : "Preview PDF"}
                              </button>
                              <button
                                className="rounded-lg bg-[#25D366]/10 px-3 py-1.5 text-[11px] font-bold text-[#128C7E] transition-colors hover:bg-[#25D366] hover:text-white disabled:opacity-50"
                                disabled={sendingId === receiptId}
                                onClick={() => handleSendReceipt(receiptId)}
                                type="button"
                              >
                                {sendingId === receiptId ? "Sending..." : "WhatsApp"}
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

        <aside className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Payment timeline</h2>
          <div className="mt-5 space-y-5">
            {transactionLedger.length === 0 ? (
              <div className="rounded-[6px] bg-[#F7F8FB] p-4 text-[13px] font-medium text-[#86868b]">No payment timeline yet.</div>
            ) : (
              transactionLedger.map((payment, index) => (
                <div className="relative pl-7" key={payment.id}>
                  <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-[#34c759] ring-4 ring-[#34c759]/15" />
                  {index < transactionLedger.length - 1 ? <span className="absolute bottom-[-22px] left-[5px] top-5 w-px bg-[rgba(0,0,0,0.08)]" /> : null}
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">{money(payment.amount)} posted</p>
                  <p className="mt-1 text-[12px] text-[#86868b]">{formatDateShort(payment.date)} - {humanizeConstant(payment.mode)}</p>
                  <p className="mt-1 text-[12px] font-semibold text-[#6e6e73]">Balance after: {money(payment.balanceAfter)}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </section>
  );
}
