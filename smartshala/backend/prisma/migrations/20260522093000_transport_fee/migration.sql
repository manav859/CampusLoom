CREATE TYPE "FeeComponent" AS ENUM ('SCHOOL_FEE', 'TRANSPORTATION_FEE');

ALTER TABLE "students"
ADD COLUMN "transportRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "transportFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "student_fee_assignments"
ADD COLUMN "transportFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "payments"
ADD COLUMN "feeComponent" "FeeComponent" NOT NULL DEFAULT 'SCHOOL_FEE';
