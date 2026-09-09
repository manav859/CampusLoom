/**
 * Razorpay's hosted checkout, typed once. Both the signed-in checkout and the
 * public payment-link page load the same script and the same global, so the
 * `Window.Razorpay` declaration has to live in exactly one place.
 */
const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

export type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayInstance = {
  open: () => void;
  close: () => void;
  on: (event: "payment.failed", handler: (payload: { error?: { description?: string } }) => void) => void;
};

export type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
  notes: Record<string, string>;
  theme: { color: string };
  handler: (response: RazorpayCheckoutResponse) => void;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export function loadRazorpayCheckout() {
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
