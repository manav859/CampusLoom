"use client";

import { FormEvent, useEffect, useState } from "react";
import { feesApi, type PaymentResult } from "@/lib/api";

type PaymentMode = "CASH" | "UPI" | "CHEQUE";

type PaymentModalProps = {
  open: boolean;
  studentId: string;
  studentName: string;
  maxAmount: number;
  onClose: () => void;
  onSuccess: (result: PaymentResult) => void;
};

export function PaymentModal({ open, studentId, studentName, maxAmount, onClose, onSuccess }: PaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<PaymentResult | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setMode("CASH");
      setError("");
      setSuccess(null);
      setDownloading(false);
    }
  }, [open]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    if (numericAmount > maxAmount) {
      setError(`Amount cannot exceed Rs ${maxAmount.toLocaleString("en-IN")}.`);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const result = await feesApi.recordPayment({ studentId, amount: numericAmount, mode });
      setSuccess(result);

      // Auto-download PDF receipt
      try {
        setDownloading(true);
        await feesApi.downloadReceiptPdf(result.receipt.id);
      } catch {
        // PDF download failed silently — user can retry via button
      } finally {
        setDownloading(false);
      }

      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadReceipt() {
    if (!success) return;
    setDownloading(true);
    try {
      await feesApi.downloadReceiptPdf(success.receipt.id);
    } catch {
      setError("Failed to download receipt PDF");
    } finally {
      setDownloading(false);
    }
  }

  function money(v: number) {
    return `Rs ${v.toLocaleString("en-IN")}`;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/30 backdrop-blur-sm sm:items-center sm:justify-center"
      style={{ animation: "modal-overlay-in 200ms ease-out" }}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-apple-lg sm:rounded-2xl"
        style={{ animation: "modal-panel-in 250ms cubic-bezier(0.25, 0.1, 0.25, 1)" }}
      >
        {success ? (
          /* ── Success View ── */
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#34c759]/10 mb-3">
                  <svg className="h-5 w-5 text-[#34c759]" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#34c759]">Payment recorded</p>
                <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-[#1d1d1f]">{studentName}</h2>
              </div>
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8e8ed] hover:bg-[#d2d2d7] transition-colors" onClick={onClose} type="button">
                <svg className="h-3.5 w-3.5 text-[#6e6e73]" fill="none" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Receipt summary */}
            <div className="rounded-2xl bg-[#f5f5f7] p-5 space-y-3">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#86868b]">Receipt No</span>
                <span className="font-semibold text-[#1d1d1f]">{success.receipt.receiptNo}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#86868b]">Amount Paid</span>
                <span className="font-bold text-[#248a3d]">{money(Number(success.payment.amount))}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#86868b]">Total Paid</span>
                <span className="font-semibold text-[#1d1d1f]">{money(success.ledger.paid)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#86868b]">Remaining Balance</span>
                <span className={`font-bold ${success.ledger.balance > 0 ? "text-[#d70015]" : "text-[#248a3d]"}`}>
                  {money(success.ledger.balance)}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#86868b]">Status</span>
                <span className={`inline-flex rounded-full px-3 py-0.5 text-[10px] font-bold tracking-wider ${
                  success.ledger.status === "PAID"
                    ? "bg-[#34c759] text-white"
                    : "bg-[#ff9500] text-white"
                }`}>
                  {success.ledger.status}
                </span>
              </div>
            </div>

            {/* WhatsApp notice */}
            <div className="rounded-xl bg-[#25D366]/10 px-4 py-3 text-[12px] text-[#128C7E] font-medium flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp receipt will be sent to parent in ~10 seconds
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleDownloadReceipt}
                disabled={downloading}
                className="btn-primary flex-1 min-h-[48px] gap-2 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {downloading ? "Downloading…" : "Download PDF"}
              </button>
              <button onClick={onClose} className="btn-secondary flex-1 min-h-[48px]">
                Done
              </button>
            </div>
          </div>
        ) : (
          /* ── Payment Form View ── */
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">Record payment</p>
                <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight text-[#1d1d1f]">{studentName}</h2>
                <p className="mt-0.5 text-[13px] text-[#86868b]">Balance: Rs {maxAmount.toLocaleString("en-IN")}</p>
              </div>
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8e8ed] hover:bg-[#d2d2d7] transition-colors" onClick={onClose} type="button">
                <svg className="h-3.5 w-3.5 text-[#6e6e73]" fill="none" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              <label className="block">
                <span className="text-[13px] font-semibold text-[#1d1d1f]">Amount</span>
                <input
                  className="glass-input mt-2 min-h-[48px] text-[17px] font-semibold"
                  inputMode="decimal"
                  min="1"
                  max={maxAmount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0"
                  type="number"
                  value={amount}
                />
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold text-[#1d1d1f]">Mode</span>
                <select className="glass-input mt-2 min-h-[48px]" onChange={(event) => setMode(event.target.value as PaymentMode)} value={mode}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </label>
              {error ? <p className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</p> : null}
              <button className="btn-primary min-h-[48px] w-full disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting} type="submit">
                {submitting ? "Recording payment…" : "Record Payment"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
