"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";
import { billingApi, formatMinor, type CheckoutSession } from "@/lib/api";
import { RazorpayCheckout } from "./RazorpayCheckout";

const METHODS = [
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
  { id: "netbanking", label: "Net banking" },
  { id: "wallet", label: "Wallet" }
] as const;

const rowClass = "flex items-center justify-between text-[13px]";

type CheckoutProps = {
  session: CheckoutSession | null;
  onClose: () => void;
  onPaid: (invoiceNumber: string) => void;
};

/**
 * Which checkout the principal gets is the server's call, not the browser's:
 * the session carries the gateway mode the order was actually created against.
 */
export function CheckoutModal(props: CheckoutProps) {
  if (props.session?.mode === "LIVE") {
    return <RazorpayCheckout onClose={props.onClose} onPaid={props.onPaid} session={props.session} />;
  }
  return <MockCheckout {...props} />;
}

/**
 * Stands in for the Razorpay checkout popup while RAZORPAY_MODE=mock. It only
 * asks the backend's mock gateway to produce a signed result, then hands that
 * to the same /checkout/confirm endpoint the real gateway callback hits — so
 * both gateways settle an invoice through exactly one code path.
 */
function MockCheckout({ session, onClose, onPaid }: CheckoutProps) {
  const [method, setMethod] = useState<string>("upi");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay(outcome: "success" | "failure") {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const result = await billingApi.mockPay(session.orderId, outcome, method);
      await billingApi.confirm({
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature
      });
      onPaid(session.invoice.number);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment could not be completed");
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;

  return (
    <Modal
      description={`Order ${session.orderId}`}
      isOpen
      onClose={busy ? () => undefined : onClose}
      title="Complete payment"
    >
      <div className="space-y-5 p-5">
        <div className="rounded-[6px] border border-[#FDE3B8] bg-[#FFF8EC] px-3 py-2 text-[12px] font-semibold text-[#8A5300]">
          Test mode — no real money moves. Signatures and webhooks behave exactly as they will in production.
        </div>

        <div className="rounded-[6px] border border-[#C9D3DE] bg-[#F7F8FB] p-4">
          <p className="text-[15px] font-semibold text-[#031526]">{session.invoice.planName}</p>
          <p className="mt-0.5 text-[12px] font-medium text-[#5A6573]">
            {new Date(session.invoice.periodStart).toLocaleDateString("en-IN", { dateStyle: "medium" })} —{" "}
            {new Date(session.invoice.periodEnd).toLocaleDateString("en-IN", { dateStyle: "medium" })}
          </p>

          <div className="mt-4 space-y-2 border-t border-[#DCE1E8] pt-3">
            <div className={rowClass}>
              <span className="text-[#5A6573]">Subtotal</span>
              <span className="font-semibold text-[#031526]">{formatMinor(session.invoice.subtotalMinor, session.currency)}</span>
            </div>
            {session.invoice.discountMinor > 0 ? (
              <div className={rowClass}>
                <span className="text-[#5A6573]">Discount</span>
                <span className="font-semibold text-[#0F8A4A]">
                  −{formatMinor(session.invoice.discountMinor, session.currency)}
                </span>
              </div>
            ) : null}
            {session.invoice.taxMinor > 0 ? (
              <div className={rowClass}>
                <span className="text-[#5A6573]">GST</span>
                <span className="font-semibold text-[#031526]">{formatMinor(session.invoice.taxMinor, session.currency)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-[#DCE1E8] pt-2 text-[15px]">
              <span className="font-semibold text-[#031526]">Amount due</span>
              <span className="font-bold text-[#031526]">{formatMinor(session.amountMinor, session.currency)}</span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[13px] font-semibold text-[#031526]">Payment method</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METHODS.map((option) => (
              <button
                className={`min-h-10 rounded-[6px] border px-3 text-[13px] font-semibold transition ${
                  method === option.id
                    ? "border-[#2456E6] bg-[#EEF3FF] text-[#2456E6]"
                    : "border-[#C2C9D4] bg-white text-[#2A3340] hover:bg-[#F7F8FB]"
                }`}
                disabled={busy}
                key={option.id}
                onClick={() => setMethod(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="rounded-[6px] border border-[#FCE3E5] bg-[#FCE3E5] px-3 py-2 text-[13px] font-semibold text-[#C8242C]">{error}</p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={() => pay("success")}
            type="button"
          >
            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : null}
            {busy ? "Processing..." : `Pay ${formatMinor(session.amountMinor, session.currency)}`}
          </button>
          <button
            className="min-h-11 rounded-[6px] border border-[#C2C9D4] bg-white px-5 text-[14px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB] disabled:opacity-50"
            disabled={busy}
            onClick={() => pay("failure")}
            type="button"
          >
            Simulate failure
          </button>
        </div>
      </div>
    </Modal>
  );
}
