export type RazorpayOrder = {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
  notes: Record<string, string>;
  created_at: number;
};

export type RazorpayRefund = {
  id: string;
  entity: "refund";
  amount: number;
  currency: string;
  payment_id: string;
  status: "processed" | "failed";
  created_at: number;
};

export type CreateOrderInput = {
  amountMinor: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
};

export type CheckoutSignature = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

/**
 * The surface both the mock and the live gateway implement. Everything the
 * billing module needs from Razorpay goes through this, so switching
 * RAZORPAY_MODE from "mock" to "live" is a config change, not a rewrite.
 */
export type RazorpayGateway = {
  mode: "MOCK" | "LIVE";
  keyId: string;
  createOrder(input: CreateOrderInput): Promise<RazorpayOrder>;
  fetchOrder(orderId: string): Promise<RazorpayOrder | null>;
  refund(paymentId: string, amountMinor: number): Promise<RazorpayRefund>;
  /** HMAC-SHA256(orderId|paymentId, keySecret) — the checkout handshake. */
  verifyCheckoutSignature(payload: CheckoutSignature): boolean;
  /** HMAC-SHA256(rawBody, webhookSecret) — the server-to-server handshake. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
};
