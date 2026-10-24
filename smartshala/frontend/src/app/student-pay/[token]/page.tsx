"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { formatMinor } from "@/lib/api";
import { loadRazorpayCheckout, type RazorpayCheckoutResponse } from "@/lib/razorpayCheckout";
import { feePayApi, type FeeCheckoutSession, type FeePaymentView } from "./payApi";

const MOCK_METHODS = [
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
  { id: "netbanking", label: "Net banking" },
  { id: "wallet", label: "Wallet" }
] as const;

const shell = "min-h-screen bg-[#f5f7fb] px-4 py-10 text-[#111827]";
const cardClass = "mx-auto w-full max-w-lg rounded-2xl border border-[#dce3ef] bg-white p-6 shadow-sm";

export default function StudentFeePayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [view, setView] = useState<FeePaymentView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<FeeCheckoutSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<string>("upi");
  const [paid, setPaid] = useState(false);
  // Razorpay's popup must be opened once per order, never again on a re-render.
  const openedOrder = useRef("");

  const load = useCallback(async () => {
    try {
      setView(await feePayApi.view(token));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "This payment link is not valid");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = useCallback(
    async (payload: RazorpayCheckoutResponse) => {
      try {
        await feePayApi.confirm(token, payload);
        setPaid(true);
        setSession(null);
        await load();
      } catch {
        setError(
          "Your payment went through, but we could not confirm it here. It will settle automatically within a few minutes — please refresh this page shortly."
        );
      } finally {
        setBusy(false);
      }
    },
    [load, token]
  );

  // The live gateway takes over the whole page once an order exists.
  useEffect(() => {
    if (!session || session.mode !== "LIVE" || openedOrder.current === session.orderId) return;
    openedOrder.current = session.orderId;

    let cancelled = false;
    void (async () => {
      try {
        await loadRazorpayCheckout();
        if (cancelled || !window.Razorpay) throw new Error("Razorpay checkout could not be loaded");

        const checkout = new window.Razorpay({
          key: session.keyId,
          order_id: session.orderId,
          amount: session.amountMinor,
          currency: session.currency,
          name: session.seller.name,
          description: `${session.fee.name} · ${session.student.name}`,
          prefill: { name: session.prefill.name, contact: session.prefill.contact },
          notes: { student: session.student.name, fee: session.fee.name },
          theme: { color: "#2456E6" },
          handler: (response) => {
            setBusy(true);
            void confirm(response);
          },
          modal: {
            ondismiss: () => {
              setBusy(false);
              setSession(null);
              openedOrder.current = "";
            }
          }
        });

        checkout.on("payment.failed", (payload) => {
          setBusy(false);
          setSession(null);
          openedOrder.current = "";
          setError(payload.error?.description ?? "The payment was declined. No amount has been charged.");
        });

        checkout.open();
      } catch (err) {
        if (!cancelled) {
          setBusy(false);
          setError(err instanceof Error ? err.message : "Razorpay checkout could not be opened");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, confirm]);

  async function startCheckout() {
    setBusy(true);
    setError("");
    try {
      const next = await feePayApi.checkout(token);
      setSession(next);
      if (next.mode === "MOCK") setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open the payment window");
      setBusy(false);
    }
  }

  async function mockPay(outcome: "success" | "failure") {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const result = await feePayApi.mockPay(token, session.orderId, outcome, method);
      if (result.status !== "success") {
        setError(result.reason ?? "The payment was declined. No amount has been charged.");
        setBusy(false);
        return;
      }
      await confirm(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment could not be completed");
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <main className={shell}>
        <div className={cardClass}>
          <h1 className="text-xl font-semibold">This link cannot be used</h1>
          <p className="mt-2 text-sm text-[#64748b]">{loadError}</p>
          <p className="mt-4 text-sm text-[#64748b]">
            Open the Fees screen in the SmartShala app and tap Pay again to get a fresh link.
          </p>
        </div>
      </main>
    );
  }

  if (!view) {
    return (
      <main className={`${shell} flex items-center justify-center`}>
        <p className="text-sm font-semibold text-[#5a6573]">Loading your fee details…</p>
      </main>
    );
  }

  const settled = paid || view.state === "PAID";

  return (
    <main className={shell}>
      <div className="mx-auto mb-4 w-full max-w-lg">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#64748b]">{view.school.name}</p>
        <h1 className="mt-1 text-2xl font-semibold">Pay school fees</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          {view.student.name}
          {view.student.admissionNumber ? ` · ${view.student.admissionNumber}` : ""}
        </p>
      </div>

      <div className={cardClass}>
        {settled ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-sm font-bold text-green-800">Payment received — thank you.</p>
            <p className="mt-1 text-sm text-green-700">
              Nothing further is due for this fee. The receipt is available on the Fees screen in the app.
            </p>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-[#dce3ef] p-4">
          <p className="text-sm font-semibold">{view.fee.name}</p>
          <dl className="mt-4 space-y-2 border-t border-[#eef2f7] pt-3 text-sm">
            <div className="flex justify-between border-t border-[#eef2f7] pt-2 text-base">
              <dt className="font-semibold">Amount due</dt>
              <dd className="font-bold">{formatMinor(view.amountDueMinor, view.currency)}</dd>
            </div>
          </dl>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
        ) : null}

        {view.state === "PAYABLE" && !settled ? (
          session?.mode === "MOCK" ? (
            <div className="mt-4 space-y-4">
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900">
                Test mode — no real money moves.
              </p>
              <div>
                <p className="text-sm font-semibold">Payment method</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MOCK_METHODS.map((option) => (
                    <button
                      className={`min-h-10 rounded-lg border px-3 text-xs font-bold transition ${
                        method === option.id
                          ? "border-[#2456e6] bg-[#eef2ff] text-[#2456e6]"
                          : "border-[#cbd5e1] bg-white text-[#334155]"
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  className="min-h-11 flex-1 rounded-lg bg-[#2456e6] px-5 text-sm font-bold text-white disabled:opacity-60"
                  disabled={busy}
                  onClick={() => mockPay("success")}
                  type="button"
                >
                  {busy ? "Processing…" : `Pay ${formatMinor(session.amountMinor, session.currency)}`}
                </button>
                <button
                  className="min-h-11 rounded-lg border border-[#cbd5e1] bg-white px-5 text-sm font-bold disabled:opacity-60"
                  disabled={busy}
                  onClick={() => mockPay("failure")}
                  type="button"
                >
                  Simulate failure
                </button>
              </div>
            </div>
          ) : (
            <button
              className="mt-4 min-h-12 w-full rounded-lg bg-[#2456e6] px-5 text-sm font-bold text-white disabled:opacity-60"
              disabled={busy}
              onClick={startCheckout}
              type="button"
            >
              {busy ? "Opening Razorpay…" : `Pay ${formatMinor(view.amountDueMinor, view.currency)} securely`}
            </button>
          )
        ) : null}

        <p className="mt-4 text-center text-xs text-[#64748b]">
          Payments are processed by Razorpay. {view.seller.name} never sees your card details.
        </p>
      </div>
    </main>
  );
}
