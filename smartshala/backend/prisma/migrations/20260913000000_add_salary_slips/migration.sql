-- CreateEnum
CREATE TYPE "SalarySlipStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "salary_slips" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recordedById" UUID,
    "month" TEXT NOT NULL,
    "basicPay" DECIMAL(12,2) NOT NULL,
    "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(12,2) NOT NULL,
    "status" "SalarySlipStatus" NOT NULL DEFAULT 'PENDING',
    "paidOn" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_slips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_slips_schoolId_month_idx" ON "salary_slips"("schoolId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "salary_slips_userId_month_key" ON "salary_slips"("userId", "month");

-- AddForeignKey
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
