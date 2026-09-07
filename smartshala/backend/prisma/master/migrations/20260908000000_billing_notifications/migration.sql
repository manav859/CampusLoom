-- Billing notifications: the record of what each school was told, and when.

CREATE TYPE "BillingNotificationType" AS ENUM (
  'INVOICE_RAISED',
  'RENEWAL_UPCOMING',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'PAST_DUE',
  'GRACE_ENDING',
  'SUSPENDED'
);
CREATE TYPE "BillingNotificationStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "billing_notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" VARCHAR(8) NOT NULL,
  "type" "BillingNotificationType" NOT NULL,
  "recipient" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "BillingNotificationStatus" NOT NULL DEFAULT 'SENT',
  "error" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "billing_notifications_pkey" PRIMARY KEY ("id")
);

-- The dedupe guard: one message per school, per type, per subject.
CREATE UNIQUE INDEX "billing_notifications_schoolId_type_dedupeKey_key"
  ON "billing_notifications"("schoolId", "type", "dedupeKey");
CREATE INDEX "billing_notifications_schoolId_createdAt_idx"
  ON "billing_notifications"("schoolId", "createdAt");

ALTER TABLE "billing_notifications"
  ADD CONSTRAINT "billing_notifications_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
