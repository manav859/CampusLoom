"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui";
import { billingApi, formatMinor, type CheckoutSession } from "@/lib/api";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

type CheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  close: () => void;
  on: (event: "payment.failed", handler: (payload: { error?: { description?: string } }) => void) => void;
};

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
  notes: Record<string, string>;
  theme: { color: string };
  handler: (response: CheckoutResponse) => void;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function loadCheckoutScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Razorpay checkout could not be loaded")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout could not be loaded"));
    document.body.appendChild(script);
  });
}

/**
 * The real gateway: Razorpay's own popup takes the card details, and the
 * callback it signs goes to the same /checkout/confirm endpoint the mock
 * gateway used. The webhook usually settles the invoice before the browser
 * even returns, so this component is only the second writer — and if the
 * browser never comes back at all, the reconciliation sweep finishes the job.
 */
export function RazorpayCheckout({
  session,
  onClose,
  onPaid
}: {
  session: CheckoutSession;
  onClose: () => void;
  onPaid: (invoiceNumber: string) => void;
}) {
  const [status, setStatus] = useState<"opening" | "open" | "confirming">("opening");
  const [error, setError] = useState("");
  // Razorpay's popup must be opened once per order, never again on a re-render.
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;

    let cancelled = false;

    void (async () => {
      try {
        await loadCheckoutScript();
        if (cancelled) return;
        if (!window.Razorpay) throw new Error("Razorpay checkout could not be loaded");

        const checkout = new window.Razorpay({
          key: session.keyId,
          order_id: session.orderId,
          amount: session.amountMinor,
          currency: session.currency,
          name: "SmartShala",
          description: `${session.invoice.planName} · ${session.invoice.number}`,
          prefill: {
            name: session.school.schoolName,
            email: session.school.email,
            contact: session.school.phone
          },
          notes: { schoolId: session.school.schoolId, invoice: session.invoice.number },
          theme: { color: "#2456E6" },
          handler: (response) => {
            setStatus("confirming");
            billingApi
              .confirm({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
              .then(() => onPaid(session.invoice.number))
              .catch(() =>
                // The money moved; only our confirmation call failed. Say so
                // plainly rather than implying the payment did not go through.
                setError(
                  "Your payment went through, but we could not confirm it here. It will settle automatically within a few minutes — please refresh this page shortly."
                )
              );
          },
          modal: { ondismiss: () => onClose() }
        });

        checkout.on("payment.failed", (payload) => {
          setError(payload.error?.description ?? "The payment was declined. No amount has been charged.");
        });

        checkout.open();
        setStatus("open");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Razorpay checkout could not be opened");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, onClose, onPaid]);

  return (
    <Modal
      description={`Order ${session.orderId}`}
      isOpen
      onClose={status === "confirming" ? () => undefined : onClose}
      title="Complete payment"
    >
      <div className="space-y-4 p-5">
        <div className="rounded-[6px] border border-[#C9D3DE] bg-[#F7F8FB] p-4">
          <p className="text-[15px] font-semibold text-[#031526]">{session.invoice.planName}</p>
          <p className="mt-0.5 text-[12px] font-medium text-[#5A6573]">Invoice {session.invoice.number}</p>
          <div className="mt-3 flex items-center justify-between border-t border-[#DCE1E8] pt-3 text-[15px]">
            <span className="font-semibold text-[#031526]">Amount due</span>
            <span className="font-bold text-[#031526]">{formatMinor(session.amountMinor, session.currency)}</span>
          </div>
        </div>

        {error ? (
          <p className="rounded-[6px] border border-[#FCE3E5] bg-[#FCE3E5] px-3 py-2 text-[13px] font-semibold text-[#C8242C]">
            {error}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-[13px] font-semibold text-[#5A6573]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#C9D3DE] border-t-[#2456E6]" aria-hidden="true" />
            {status === "confirming" ? "Confirming your payment…" : "Opening the Razorpay payment window…"}
          </p>
        )}

        {error ? (
          <button
            className="min-h-11 w-full rounded-[6px] border border-[#C2C9D4] bg-white px-5 text-[14px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
