-- Billing & subscriptions -----------------------------------------------------

CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'DUE', 'PAID', 'VOID', 'REFUNDED');
CREATE TYPE "PaymentState" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');
CREATE TYPE "GatewayMode" AS ENUM ('MOCK', 'LIVE');

-- Coupons gain redemption limits so the super admin can cap a campaign.
ALTER TABLE "coupons"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "maxRedemptions" INTEGER,
  ADD COLUMN "redeemedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "plans" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priceMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "interval" "BillingInterval" NOT NULL DEFAULT 'YEAR',
  "intervalCount" INTEGER NOT NULL DEFAULT 1,
  "trialDays" INTEGER NOT NULL DEFAULT 0,
  "maxStudents" INTEGER,
  "maxStaff" INTEGER,
  "features" JSONB NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");
CREATE INDEX "plans_isActive_sortOrder_idx" ON "plans"("isActive", "sortOrder");

CREATE TABLE "subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" VARCHAR(8) NOT NULL,
  "planId" UUID NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "gracePeriodEndsAt" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "cancelledAt" TIMESTAMP(3),
  "couponCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscriptions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("schoolId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "subscriptions_schoolId_key" ON "subscriptions"("schoolId");
CREATE INDEX "subscriptions_status_currentPeriodEnd_idx" ON "subscriptions"("status", "currentPeriodEnd");

CREATE TABLE "invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "number" TEXT NOT NULL,
  "schoolId" VARCHAR(8) NOT NULL,
  "subscriptionId" UUID,
  "planId" UUID,
  "planCode" TEXT NOT NULL,
  "planName" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DUE',
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "subtotalMinor" INTEGER NOT NULL,
  "discountMinor" INTEGER NOT NULL DEFAULT 0,
  "taxMinor" INTEGER NOT NULL DEFAULT 0,
  "totalMinor" INTEGER NOT NULL,
  "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
  "couponCode" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoices_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("schoolId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "invoices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");
CREATE INDEX "invoices_schoolId_issuedAt_idx" ON "invoices"("schoolId", "issuedAt");
CREATE INDEX "invoices_status_dueAt_idx" ON "invoices"("status", "dueAt");

-- Race-free invoice numbers.
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE TABLE "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoiceId" UUID NOT NULL,
  "schoolId" VARCHAR(8) NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'razorpay',
  "gatewayMode" "GatewayMode" NOT NULL DEFAULT 'MOCK',
  "providerOrderId" TEXT,
  "providerPaymentId" TEXT,
  "providerSignature" TEXT,
  "status" "PaymentState" NOT NULL DEFAULT 'CREATED',
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "method" TEXT,
  "failureReason" TEXT,
  "refundedMinor" INTEGER NOT NULL DEFAULT 0,
  "refundReference" TEXT,
  "capturedAt" TIMESTAMP(3),
  "notes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "payments_providerOrderId_key" ON "payments"("providerOrderId");
CREATE UNIQUE INDEX "payments_providerPaymentId_key" ON "payments"("providerPaymentId");
CREATE INDEX "payments_schoolId_createdAt_idx" ON "payments"("schoolId", "createdAt");
CREATE INDEX "payments_status_idx" ON "payments"("status");

CREATE TABLE "webhook_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL DEFAULT 'razorpay',
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "signatureValid" BOOLEAN NOT NULL DEFAULT false,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "webhook_events_provider_eventId_key" ON "webhook_events"("provider", "eventId");
CREATE INDEX "webhook_events_eventType_createdAt_idx" ON "webhook_events"("eventType", "createdAt");

CREATE TABLE "billing_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" VARCHAR(8),
  "actor" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "billing_events_schoolId_createdAt_idx" ON "billing_events"("schoolId", "createdAt");
CREATE INDEX "billing_events_action_createdAt_idx" ON "billing_events"("action", "createdAt");

-- Seed the two plans the product already sells so no school is left planless.
INSERT INTO "plans" ("code", "name", "description", "priceMinor", "interval", "trialDays", "maxStudents", "maxStaff", "features", "isPublic", "sortOrder")
VALUES
  ('TRIAL', '30-day Trial', 'Full access to evaluate SmartShala for 30 days.', 0, 'YEAR', 30, 500, 50,
   '{"attendance":true,"fees":true,"marks":true,"reports":true,"whatsapp":false,"analytics":false,"chatbot":false}', false, 0),
  ('STANDARD', 'Standard', 'Everything a single school needs, billed yearly.', 2000000, 'YEAR', 0, NULL, NULL,
   '{"attendance":true,"fees":true,"marks":true,"reports":true,"whatsapp":true,"analytics":true,"chatbot":true}', true, 10)
ON CONFLICT ("code") DO NOTHING;

-- Backfill a subscription for every live school from its denormalised columns.
INSERT INTO "subscriptions" ("schoolId", "planId", "status", "currentPeriodStart", "currentPeriodEnd", "couponCode")
SELECT
  s."schoolId",
  (SELECT p."id" FROM "plans" p WHERE p."code" = CASE WHEN s."isTrial" THEN 'TRIAL' ELSE 'STANDARD' END),
  CASE
    WHEN s."isTrial" AND COALESCE(s."trialEndsAt", CURRENT_TIMESTAMP + INTERVAL '30 days') > CURRENT_TIMESTAMP THEN 'TRIALING'::"SubscriptionStatus"
    WHEN s."paymentStatus" = 'PAID' THEN 'ACTIVE'::"SubscriptionStatus"
    WHEN s."isActive" THEN 'ACTIVE'::"SubscriptionStatus"
    ELSE 'PAST_DUE'::"SubscriptionStatus"
  END,
  s."createdAt",
  CASE
    WHEN s."isTrial" THEN COALESCE(s."trialEndsAt", s."createdAt" + INTERVAL '30 days')
    ELSE s."createdAt" + INTERVAL '1 year'
  END,
  s."couponCode"
FROM "schools" s
WHERE s."deletionStatus" <> 'DELETED'
ON CONFLICT ("schoolId") DO NOTHING;
