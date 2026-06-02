CREATE TYPE "FeeAdjustmentType" AS ENUM ('CONCESSION', 'DISCOUNT');

CREATE TABLE "fee_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "recordedById" UUID NOT NULL,
    "type" "FeeAdjustmentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fee_adjustments_schoolId_studentId_createdAt_idx" ON "fee_adjustments"("schoolId", "studentId", "createdAt");
CREATE INDEX "fee_adjustments_schoolId_assignmentId_idx" ON "fee_adjustments"("schoolId", "assignmentId");

ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "student_fee_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
