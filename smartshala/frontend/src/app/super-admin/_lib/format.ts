import { formatMinor } from "@/lib/api";
import type { Invoice, PaymentLinkRow, Plan, SubscriptionStatus } from "./types";

export type Tone = "good" | "info" | "warn" | "danger" | "neutral";

export const money = formatMinor;

export function fmtDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function fmtDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** "3h ago", "2 days ago" — for activity feeds, where the exact minute rarely matters. */
export function timeAgo(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return fmtDate(value);
}

export function intervalLabel(plan: Pick<Plan, "interval" | "intervalCount">) {
  const unit = plan.interval === "MONTH" ? "month" : "year";
  return plan.intervalCount === 1 ? `per ${unit}` : `every ${plan.intervalCount} ${unit}s`;
}

export function daysLeftLabel(days: number) {
  if (days === 0) return "Ends today";
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} left`;
  const ago = Math.abs(days);
  return `Ended ${ago} day${ago === 1 ? "" : "s"} ago`;
}

/** Billing states in the words a school owner would use, not the enum names. */
export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "good" },
  TRIALING: { label: "Free trial", tone: "info" },
  PAST_DUE: { label: "Payment overdue", tone: "warn" },
  EXPIRED: { label: "Expired", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" }
};

export const INVOICE_STATUS: Record<Invoice["status"], { label: string; tone: Tone }> = {
  DUE: { label: "Unpaid", tone: "warn" },
  PAID: { label: "Paid", tone: "good" },
  DRAFT: { label: "Draft", tone: "neutral" },
  VOID: { label: "Cancelled", tone: "neutral" },
  REFUNDED: { label: "Refunded", tone: "info" }
};

export function linkStatus(link: Pick<PaymentLinkRow, "status" | "expiresAt">): { label: string; tone: Tone } {
  if (link.status === "PAID") return { label: "Paid", tone: "good" };
  if (link.status === "REVOKED") return { label: "Revoked", tone: "neutral" };
  if (new Date(link.expiresAt).getTime() < Date.now()) return { label: "Expired", tone: "neutral" };
  return { label: "Waiting for payment", tone: "info" };
}

export function errorMessage(error: unknown, fallback = "Something went wrong") {
  return error instanceof Error && error.message ? error.message : fallback;
}
