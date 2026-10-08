-- Sales CRM: leads, their timeline, proforma invoices, and the sales staff who
-- work them. A lead pays its proforma before any school exists, so payments and
-- payment links can now belong to a proforma instead of a school's invoice.

CREATE TYPE "CrmRole" AS ENUM ('ADMIN', 'SALES');
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'PROFORMA_SENT', 'PAID', 'ONBOARDED', 'LOST');
CREATE TYPE "LeadSource" AS ENUM ('CRM', 'WEBSITE');
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'RUNNING', 'DONE', 'FAILED');
CREATE TYPE "ProformaStatus" AS ENUM ('ISSUED', 'PAID', 'CANCELLED');

CREATE TABLE "crm_users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" "CrmRole" NOT NULL DEFAULT 'SALES',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "crm_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_users_email_key" ON "crm_users"("email");

CREATE TABLE "leads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "number" SERIAL NOT NULL,
  "schoolName" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT,
  "gstin" VARCHAR(15),
  "stateName" TEXT,
  "stateCode" VARCHAR(2),
  "numberOfStudents" INTEGER,
  "numberOfStaff" INTEGER,
  "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
  "source" "LeadSource" NOT NULL DEFAULT 'CRM',
  "lostReason" TEXT,
  "lostAt" TIMESTAMP(3),
  "assignedToId" UUID,
  "createdBy" TEXT NOT NULL,
  "schoolId" VARCHAR(8),
  "paidAt" TIMESTAMP(3),
  "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "onboardingError" TEXT,
  "onboardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leads_number_key" ON "leads"("number");
-- The school ID is reserved on the lead at payment, before the school exists.
CREATE UNIQUE INDEX "leads_schoolId_key" ON "leads"("schoolId");
CREATE INDEX "leads_assignedToId_stage_idx" ON "leads"("assignedToId", "stage");
CREATE INDEX "leads_stage_updatedAt_idx" ON "leads"("stage", "updatedAt");
CREATE INDEX "leads_phone_idx" ON "leads"("phone");
CREATE INDEX "leads_email_idx" ON "leads"("email");

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "crm_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "lead_activities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "leadId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_activities_leadId_createdAt_idx" ON "lead_activities"("leadId", "createdAt");

ALTER TABLE "lead_activities"
  ADD CONSTRAINT "lead_activities_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "proformas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "number" TEXT NOT NULL,
  "leadId" UUID NOT NULL,
  "planId" UUID,
  "planCode" TEXT NOT NULL,
  "planName" TEXT NOT NULL,
  "status" "ProformaStatus" NOT NULL DEFAULT 'ISSUED',
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "listPriceMinor" INTEGER NOT NULL,
  "subtotalMinor" INTEGER NOT NULL,
  "discountMinor" INTEGER NOT NULL DEFAULT 0,
  "taxMinor" INTEGER NOT NULL DEFAULT 0,
  "totalMinor" INTEGER NOT NULL,
  "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
  "couponCode" TEXT,
  "notes" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "invoiceId" UUID,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "proformas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proformas_number_key" ON "proformas"("number");
CREATE UNIQUE INDEX "proformas_invoiceId_key" ON "proformas"("invoiceId");
CREATE INDEX "proformas_leadId_issuedAt_idx" ON "proformas"("leadId", "issuedAt");
CREATE INDEX "proformas_status_idx" ON "proformas"("status");

ALTER TABLE "proformas"
  ADD CONSTRAINT "proformas_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "proformas"
  ADD CONSTRAINT "proformas_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proformas"
  ADD CONSTRAINT "proformas_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Proforma numbers run in their own series (PI-2026-000001), separate from tax invoices.
CREATE SEQUENCE IF NOT EXISTS proforma_number_seq START 1;

-- Payments: a lead's payment has only proformaId until onboarding attaches it
-- to the new school and its tax invoice.
ALTER TABLE "payments" ADD COLUMN "proformaId" UUID;
ALTER TABLE "payments" ALTER COLUMN "invoiceId" DROP NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "schoolId" DROP NOT NULL;
CREATE INDEX "payments_proformaId_idx" ON "payments"("proformaId");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_proformaId_fkey"
  FOREIGN KEY ("proformaId") REFERENCES "proformas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment links: one pays a school's invoice, the other kind a lead's proforma.
ALTER TABLE "payment_links" ADD COLUMN "proformaId" UUID;
ALTER TABLE "payment_links" ALTER COLUMN "invoiceId" DROP NOT NULL;
ALTER TABLE "payment_links" ALTER COLUMN "schoolId" DROP NOT NULL;
CREATE INDEX "payment_links_proformaId_status_idx" ON "payment_links"("proformaId", "status");

ALTER TABLE "payment_links"
  ADD CONSTRAINT "payment_links_proformaId_fkey"
  FOREIGN KEY ("proformaId") REFERENCES "proformas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_links"
  ADD CONSTRAINT "payment_links_invoice_or_proforma_check"
  CHECK (("invoiceId" IS NOT NULL) <> ("proformaId" IS NOT NULL));
