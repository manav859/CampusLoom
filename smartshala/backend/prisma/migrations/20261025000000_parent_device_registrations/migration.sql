-- Parent devices for push. A parent has no User row (they sign in by mobile +
-- admission number, see auth.service parentLogin), so `userId` becomes nullable
-- and a `parentPhone` column — the guardian's last-ten-digit mobile, the same
-- identity the token carries — is what a parent push is targeted by. A row is
-- either a staff device (userId set, parentPhone null) or a parent device
-- (userId null, parentPhone set); the push module enforces that split.

-- AlterTable
ALTER TABLE "device_registrations" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "device_registrations" ADD COLUMN "parentPhone" VARCHAR(10);

-- CreateIndex
CREATE INDEX "device_registrations_schoolId_parentPhone_idx" ON "device_registrations"("schoolId", "parentPhone");
