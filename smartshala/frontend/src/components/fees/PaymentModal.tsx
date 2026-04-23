"use client";

import { FormEvent, useEffect, useState } from "react";
import { feesApi } from "@/lib/api";

type PaymentMode = "CASH" | "UPI" | "CHEQUE";

type PaymentModalProps = {
  open: boolean;
  studentId: string;
  studentName: string;
  maxAmount: number;
  onClose: () => void;
  onSuccess: () => void;
};

export function PaymentModal({ open, studentId, studentName, maxAmount, onClose, onSuccess }: PaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setMode("CASH");
      setError("");
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
      await feesApi.recordPayment({ studentId, amount: numericAmount, mode });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
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
            {submitting ? "Saving payment…" : "Save payment"}
          </button>
        </form>
      </div>
    </div>
  );
}
