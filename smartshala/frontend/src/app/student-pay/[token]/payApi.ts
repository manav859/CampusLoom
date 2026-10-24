import { env } from "@/lib/env";

/**
 * The student-fee payment API is unauthenticated and never tenant-prefixed — the
 * token in the URL is the whole credential, which routes the request to the
 * right tenant on the server — so it bypasses the tenant-aware apiFetch.
 */
async function payFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}/student-pay${path}`, {
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

export type FeePaymentView = {
  state: "PAYABLE" | "PAID";
  currency: string;
  amountDueMinor: number;
  student: { name: string; admissionNumber: string | null };
  school: { name: string; schoolId: string };
  fee: { name: string };
  seller: { name: string };
};

export type FeeCheckoutSession = {
  mode: "MOCK" | "LIVE";
  keyId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  student: { name: string };
  fee: { name: string };
  prefill: { name: string; contact: string };
  seller: { name: string };
};

export type CheckoutSignature = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export const feePayApi = {
  view: (token: string) => payFetch<FeePaymentView>(`/${token}`),
  checkout: (token: string) => payFetch<FeeCheckoutSession>(`/${token}/checkout`, { method: "POST" }),
  confirm: (token: string, payload: CheckoutSignature) =>
    payFetch<{ status: string; receiptNo: string | null }>(`/${token}/confirm`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  mockPay: (token: string, orderId: string, outcome: "success" | "failure", method: string) =>
    payFetch<CheckoutSignature & { status: string; reason?: string }>(`/${token}/mock-gateway/pay`, {
      method: "POST",
      body: JSON.stringify({ orderId, outcome, method })
    })
};
