-- AlterTable
ALTER TABLE "payments" ADD COLUMN "idempotencyKey" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "payments_schoolId_idempotencyKey_key" ON "payments"("schoolId", "idempotencyKey");

-- CreateIndex (Partial)
CREATE UNIQUE INDEX "payments_schoolId_upiTransactionId_key" ON "payments"("schoolId", "upiTransactionId") WHERE "upiTransactionId" IS NOT NULL;
CREATE UNIQUE INDEX "payments_schoolId_chequeNumber_key" ON "payments"("schoolId", "chequeNumber") WHERE "chequeNumber" IS NOT NULL;
CREATE UNIQUE INDEX "payments_schoolId_gatewayTransactionId_key" ON "payments"("schoolId", "gatewayTransactionId") WHERE "gatewayTransactionId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "payments_assignmentId_idx" ON "payments"("assignmentId");
CREATE INDEX "payments_installmentId_idx" ON "payments"("installmentId");
CREATE INDEX "payments_schoolId_recordedById_paidAt_idx" ON "payments"("schoolId", "recordedById", "paidAt");

-- CreateIndex
CREATE INDEX "fee_adjustments_schoolId_recordedById_idx" ON "fee_adjustments"("schoolId", "recordedById");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");
