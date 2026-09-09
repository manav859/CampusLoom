import { env } from "@/lib/env";

/**
 * The payment-link API is unauthenticated and never tenant-prefixed — the token
 * in the URL is the whole credential — so it deliberately bypasses the
 * tenant-aware apiFetch in lib/api.ts.
 */
async function payFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}/pay${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((payload as { error?: { message?: string } } | null)?.error?.message ?? "Request failed");
  }
  return payload as T;
}

export type LinkState = "PAYABLE" | "PAID" | "VOID" | "EXPIRED";

export type PaymentLinkView = {
  state: LinkState;
  expiresAt: string;
  note: string | null;
  seller: { name: string; supportEmail: string | null };
  school: { schoolId: string; schoolName: string };
  invoice: {
    number: string;
    planName: string;
    currency: string;
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
    amountPaidMinor: number;
    amountDueMinor: number;
    periodStart: string;
    periodEnd: string;
    issuedAt: string;
    dueAt: string;
  };
};

export type PayCheckoutSession = {
  mode: "MOCK" | "LIVE";
  keyId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  invoice: { number: string; planName: string };
  school: { schoolId: string; schoolName: string; email: string; phone: string };
  seller: { name: string };
};

export type CheckoutSignature = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export const payApi = {
  view: (token: string) => payFetch<PaymentLinkView>(`/${token}`),
  checkout: (token: string) => payFetch<PayCheckoutSession>(`/${token}/checkout`, { method: "POST" }),
  confirm: (token: string, payload: CheckoutSignature) =>
    payFetch<{ status: string; invoiceNumber: string }>(`/${token}/confirm`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  mockPay: (token: string, orderId: string, outcome: "success" | "failure", method: string) =>
    payFetch<CheckoutSignature & { status: string; reason?: string }>(`/${token}/mock-gateway/pay`, {
      method: "POST",
      body: JSON.stringify({ orderId, outcome, method })
    })
};
