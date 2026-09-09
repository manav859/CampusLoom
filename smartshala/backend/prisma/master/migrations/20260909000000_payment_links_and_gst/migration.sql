-- Shareable payment links, and the buyer tax identity a GST invoice needs.

-- Tax identity of the school being billed. Null gstin means an unregistered
-- buyer; stateCode decides CGST+SGST (intra-state) vs IGST (inter-state).
ALTER TABLE "schools" ADD COLUMN "gstin" VARCHAR(15);
ALTER TABLE "schools" ADD COLUMN "stateName" TEXT;
ALTER TABLE "schools" ADD COLUMN "stateCode" VARCHAR(2);

CREATE TYPE "PaymentLinkStatus" AS ENUM ('ACTIVE', 'PAID', 'REVOKED');

CREATE TABLE "payment_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token" TEXT NOT NULL,
  "invoiceId" UUID NOT NULL,
  "schoolId" VARCHAR(8) NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "PaymentLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "note" TEXT,
  "createdBy" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "firstViewedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- The token is the only credential the link carries, so it must be unique.
CREATE UNIQUE INDEX "payment_links_token_key" ON "payment_links"("token");
CREATE INDEX "payment_links_schoolId_createdAt_idx" ON "payment_links"("schoolId", "createdAt");
CREATE INDEX "payment_links_invoiceId_status_idx" ON "payment_links"("invoiceId", "status");

ALTER TABLE "payment_links"
  ADD CONSTRAINT "payment_links_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_links"
  ADD CONSTRAINT "payment_links_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
