CREATE TYPE "TenantDeletionStatus" AS ENUM ('NONE', 'PENDING', 'CANCELLED', 'DELETED', 'FAILED');

ALTER TABLE "schools"
ADD COLUMN "deletionStatus" "TenantDeletionStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN "deletionScheduledAt" TIMESTAMP(3),
ADD COLUMN "deletionCancelledAt" TIMESTAMP(3),
ADD COLUMN "deletionExecutedAt" TIMESTAMP(3),
ADD COLUMN "deletionRequestedBy" TEXT;

CREATE INDEX "schools_deletionStatus_deletionScheduledAt_idx"
ON "schools"("deletionStatus", "deletionScheduledAt");
