import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import type {
  CheckoutSignature,
  CreateOrderInput,
  RazorpayGateway,
  RazorpayOrder,
  RazorpayRefund
} from "./razorpay.types.js";

export type { CheckoutSignature, RazorpayGateway, RazorpayOrder } from "./razorpay.types.js";

function hmac(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** Constant-time compare so a wrong signature cannot be brute-forced by timing. */
function safeEqual(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function signCheckout(orderId: string, paymentId: string) {
  return hmac(`${orderId}|${paymentId}`, env.RAZORPAY_KEY_SECRET);
}

export function signWebhook(rawBody: string) {
  return hmac(rawBody, env.RAZORPAY_WEBHOOK_SECRET);
}

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(9).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 14)}`;
}

const sharedVerification = {
  keyId: env.RAZORPAY_KEY_ID,
  verifyCheckoutSignature(payload: CheckoutSignature) {
    return safeEqual(signCheckout(payload.razorpay_order_id, payload.razorpay_payment_id), payload.razorpay_signature);
  },
  verifyWebhookSignature(rawBody: string, signature: string) {
    return safeEqual(signWebhook(rawBody), signature);
  }
};

// --- Mock gateway ------------------------------------------------------------
// Orders live in memory only; the Payment row in the master DB is the durable
// record, so a restart mid-checkout loses nothing that matters.

const mockOrders = new Map<string, RazorpayOrder>();

const mockGateway: RazorpayGateway = {
  ...sharedVerification,
  mode: "MOCK",
  async createOrder(input: CreateOrderInput) {
    const order: RazorpayOrder = {
      id: randomId("order"),
      entity: "order",
      amount: input.amountMinor,
      amount_paid: 0,
      amount_due: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt,
      status: "created",
      notes: input.notes,
      created_at: Math.floor(Date.now() / 1000)
    };
    mockOrders.set(order.id, order);
    return order;
  },
  async fetchOrder(orderId: string) {
    return mockOrders.get(orderId) ?? null;
  },
  async refund(paymentId: string, amountMinor: number): Promise<RazorpayRefund> {
    return {
      id: randomId("rfnd"),
      entity: "refund",
      amount: amountMinor,
      currency: env.BILLING_CURRENCY,
      payment_id: paymentId,
      status: "processed",
      created_at: Math.floor(Date.now() / 1000)
    };
  }
};

/** Called by the mock checkout endpoints to flip an in-memory order to paid. */
export function markMockOrderPaid(orderId: string) {
  const order = mockOrders.get(orderId);
  if (!order) return;
  order.status = "paid";
  order.amount_paid = order.amount;
  order.amount_due = 0;
}

// --- Live gateway ------------------------------------------------------------

const RAZORPAY_API = "https://api.razorpay.com/v1";

async function razorpayRequest<T>(path: string, init: RequestInit): Promise<T> {
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
      ...(init.headers ?? {})
    }
  });

  const body = (await response.json().catch(() => null)) as { error?: { description?: string } } | null;
  if (!response.ok) {
    throw new AppError(502, body?.error?.description ?? "Razorpay request failed", "RAZORPAY_REQUEST_FAILED");
  }
  return body as T;
}

const liveGateway: RazorpayGateway = {
  ...sharedVerification,
  mode: "LIVE",
  createOrder(input: CreateOrderInput) {
    return razorpayRequest<RazorpayOrder>("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: input.amountMinor,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes
      })
    });
  },
  async fetchOrder(orderId: string) {
    return razorpayRequest<RazorpayOrder>(`/orders/${orderId}`, { method: "GET" }).catch(() => null);
  },
  refund(paymentId: string, amountMinor: number) {
    return razorpayRequest<RazorpayRefund>(`/payments/${paymentId}/refund`, {
      method: "POST",
      body: JSON.stringify({ amount: amountMinor })
    });
  }
};

export const razorpay: RazorpayGateway = env.RAZORPAY_MODE === "live" ? liveGateway : mockGateway;

export function isMockGateway() {
  return env.RAZORPAY_MODE !== "live";
}

export function assertMockGateway() {
  if (!isMockGateway()) {
    throw new AppError(404, "The mock gateway is disabled in live mode", "MOCK_GATEWAY_DISABLED");
  }
}
