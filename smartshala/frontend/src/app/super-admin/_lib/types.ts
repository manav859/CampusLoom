import type { Invoice, PaymentRow, Plan, SubscriptionStatus } from "@/lib/api";

export type { Invoice, PaymentRow, Plan, SubscriptionStatus };

export type PlanRow = Plan & { subscriberCount: number };

export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  maxRedemptions: number | null;
  redeemedCount: number;
  isActive: boolean;
  expiresAt: string | null;
};

export type SchoolContact = {
  schoolId: string;
  schoolName: string;
  ownerName: string;
  email: string;
  phone: string;
};

export type SubscriptionRow = {
  id: string;
  schoolId: string;
  status: SubscriptionStatus;
  customPriceMinor: number | null;
  customPriceNote: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
  school: SchoolContact & { isActive: boolean };
};

export type BillingEvent = {
  id: string;
  schoolId: string | null;
  actor: string;
  action: string;
  message: string;
  createdAt: string;
};

export type Summary = {
  statusCounts: Partial<Record<SubscriptionStatus, number>>;
  mrrMinor: number;
  arrMinor: number;
  lifetimeCollectedMinor: number;
  collectedThisMonthMinor: number;
  outstandingMinor: number;
  outstandingInvoiceCount: number;
  expiringSoon: number;
  recentEvents: BillingEvent[];
  gateway: { mode: "MOCK" | "LIVE" };
};

export type BillingNotification = {
  id: string;
  type: string;
  recipient: string;
  message: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  error: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type SchoolBilling = {
  school: SchoolContact & {
    isActive: boolean;
    address: string;
    gstin: string | null;
    stateName: string | null;
    stateCode: string | null;
  };
  subscription: SubscriptionRow;
  pricing: {
    listPriceMinor: number;
    effectivePriceMinor: number;
    isCustomPrice: boolean;
    customPriceNote: string | null;
  };
  limits: { maxStudents: number | null; maxStaff: number | null };
  invoices: Invoice[];
  events: BillingEvent[];
  notifications: BillingNotification[];
};

export type SchoolUsage = { students: number | null; staff: number | null; reachable: boolean };

export type LedgerInvoice = Invoice & { school: { schoolName: string } };

export type PaymentLinkRow = {
  id: string;
  token: string;
  url: string;
  status: "ACTIVE" | "PAID" | "REVOKED";
  amountMinor: number;
  currency: string;
  note: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  firstViewedAt: string | null;
  paidAt: string | null;
  revokedAt: string | null;
  invoice: { id: string; number: string; status: Invoice["status"]; totalMinor: number; amountPaidMinor: number; planName: string };
  school: { schoolId: string; schoolName: string; email: string };
};

export type RenewalRow = {
  schoolId: string;
  school: SchoolContact;
  status: SubscriptionStatus;
  plan: Pick<Plan, "code" | "name" | "interval" | "intervalCount" | "priceMinor" | "currency">;
  currentPeriodEnd: string;
  gracePeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  daysLeft: number;
  effectivePriceMinor: number;
  isCustomPrice: boolean;
  openInvoice: {
    id: string;
    number: string;
    planCode: string;
    planName: string;
    totalMinor: number;
    amountPaidMinor: number;
    currency: string;
    dueAt: string;
  } | null;
  paymentLink: { id: string; url: string; expiresAt: string; firstViewedAt: string | null } | null;
};

export type RenewalCollection = "PAYMENT_LINK" | "PAID_OFFLINE" | "INVOICE_ONLY";

export type RenewResult = {
  invoice: Omit<Invoice, "payments">;
  reusedInvoice: boolean;
  /** Older open invoices this renewal voided, so the school cannot pay twice. */
  supersededInvoices: string[];
  paymentLink: PaymentLinkRow | null;
};

export const OFFLINE_METHODS = ["neft", "upi", "cheque", "cash", "card", "other"] as const;
export type OfflineMethod = (typeof OFFLINE_METHODS)[number];
