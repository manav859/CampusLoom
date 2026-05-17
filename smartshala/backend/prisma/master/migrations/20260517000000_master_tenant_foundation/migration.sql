CREATE TYPE "PlanType" AS ENUM ('TRIAL', 'STANDARD');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'TRIAL');
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

CREATE TABLE "schools" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" VARCHAR(8) NOT NULL,
  "schoolName" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "numberOfStudents" INTEGER NOT NULL,
  "numberOfStaff" INTEGER NOT NULL,
  "planType" "PlanType" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "couponCode" TEXT,
  "isTrial" BOOLEAN NOT NULL DEFAULT false,
  "trialEndsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "dbName" TEXT NOT NULL,
  "dbUrl" TEXT NOT NULL,
  "directDbUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coupons" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "discountType" "DiscountType" NOT NULL,
  "discountValue" DECIMAL(12,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "onboarding_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" VARCHAR(8) NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onboarding_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schools_schoolId_key" ON "schools"("schoolId");
CREATE UNIQUE INDEX "schools_dbName_key" ON "schools"("dbName");
CREATE INDEX "schools_schoolId_isActive_idx" ON "schools"("schoolId", "isActive");
CREATE INDEX "schools_email_idx" ON "schools"("email");
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_code_isActive_idx" ON "coupons"("code", "isActive");
CREATE INDEX "onboarding_logs_schoolId_createdAt_idx" ON "onboarding_logs"("schoolId", "createdAt");
