CREATE TYPE "PasswordResetStatus" AS ENUM ('PENDING', 'COMPLETED', 'DISMISSED');

CREATE TABLE "password_reset_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" VARCHAR(8) NOT NULL,
  "userId" UUID NOT NULL,
  "userName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "status" "PasswordResetStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "completedBy" TEXT,

  CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_requests_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("schoolId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "password_reset_requests_status_requestedAt_idx" ON "password_reset_requests"("status", "requestedAt");
CREATE INDEX "password_reset_requests_schoolId_status_idx" ON "password_reset_requests"("schoolId", "status");
