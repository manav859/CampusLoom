export type CrmRole = "ADMIN" | "SALES";

export type CrmUser = { id: string | null; name: string; role: CrmRole };

export type LeadStage = "NEW" | "CONTACTED" | "PROFORMA_SENT" | "PAID" | "ONBOARDED" | "LOST";

export type OnboardingStatus = "NOT_STARTED" | "RUNNING" | "DONE" | "FAILED";

export type ProformaStatus = "ISSUED" | "PAID" | "CANCELLED";

export type LeadContact = {
  schoolName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string | null;
  gstin: string | null;
  stateName: string | null;
  stateCode: string | null;
  numberOfStudents: number | null;
  numberOfStaff: number | null;
};

export type LeadRow = LeadContact & {
  id: string;
  number: number;
  code: string;
  stage: LeadStage;
  source: "CRM" | "WEBSITE" | "META";
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  schoolId: string | null;
  onboardingStatus: OnboardingStatus;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
  proforma: { number: string; totalMinor: number; status: ProformaStatus } | null;
};

export type LeadList = { counts: Partial<Record<LeadStage, number>>; leads: LeadRow[] };

export type Activity = { id: string; type: string; message: string; actor: string; createdAt: string };

export type PaymentLink = {
  id: string;
  token: string;
  url: string;
  status: "ACTIVE" | "PAID" | "REVOKED";
  amountMinor: number;
  note: string | null;
  expiresAt: string;
  firstViewedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  shareText: string | null;
};

export type LeadPayment = {
  id: string;
  status: "CREATED" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";
  amountMinor: number;
  method: string | null;
  failureReason: string | null;
  providerPaymentId: string | null;
  capturedAt: string | null;
  createdAt: string;
};

export type Proforma = {
  id: string;
  number: string;
  planCode: string;
  planName: string;
  status: ProformaStatus;
  currency: string;
  listPriceMinor: number;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  couponCode: string | null;
  notes: string | null;
  issuedAt: string;
  validUntil: string;
  paidAt: string | null;
  createdBy: string;
  invoice: { id: string; number: string; status: string } | null;
  paymentLinks: PaymentLink[];
  payments: LeadPayment[];
};

export type LeadDetail = Omit<LeadRow, "proforma"> & {
  lostAt: string | null;
  paidAt: string | null;
  onboardingError: string | null;
  onboardedAt: string | null;
  createdBy: string;
  activities: Activity[];
  proformas: Proforma[];
  school: { schoolId: string; isActive: boolean; subscription: { status: string; currentPeriodEnd: string } | null } | null;
};

export type Plan = {
  id: string;
  code: string;
  name: string;
  priceMinor: number;
  currency: string;
  interval: "MONTH" | "YEAR";
  intervalCount: number;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: CrmRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  leadCount: number;
};

export type CrmPayment = {
  id: string;
  status: LeadPayment["status"];
  amountMinor: number;
  refundedMinor: number;
  currency: string;
  method: string | null;
  gatewayMode: "MOCK" | "LIVE";
  providerOrderId: string | null;
  providerPaymentId: string | null;
  failureReason: string | null;
  capturedAt: string | null;
  createdAt: string;
  invoice: { id: string; number: string } | null;
  proforma: {
    id: string;
    number: string;
    planName: string;
    listPriceMinor: number;
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
    couponCode: string | null;
    createdBy: string;
  };
  lead: {
    id: string;
    code: string;
    schoolName: string;
    ownerName: string;
    email: string;
    phone: string;
    gstin: string | null;
    schoolId: string | null;
    onboardingStatus: OnboardingStatus;
    assignedTo: { id: string; name: string } | null;
  };
};

export type PaymentsPage = {
  summary: { collectedMinor: number; paymentsCount: number; lostMinor: number; lostLeads: number };
  payments: CrmPayment[];
};

export type MetaStatus =
  | { connected: false }
  | {
      connected: true;
      pageId: string;
      pageName: string;
      formIds: string[];
      lastSyncedAt: string | null;
      lastSyncError: string | null;
      connectedBy: string;
      createdAt: string;
      imported: number;
      autoSync: boolean;
    };

export type MetaForm = { id: string; name: string; status: string; leadsCount: number | null };

export type MetaSyncResult = { created: number; merged: number; failed: number };
