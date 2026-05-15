ALTER TYPE "PaymentMode" ADD VALUE IF NOT EXISTS 'DD';
ALTER TYPE "PaymentMode" ADD VALUE IF NOT EXISTS 'ONLINE_GATEWAY';

ALTER TABLE "payments"
  ADD COLUMN "upiTransactionId" TEXT,
  ADD COLUMN "chequeNumber" TEXT,
  ADD COLUMN "ddNumber" TEXT,
  ADD COLUMN "gatewayTransactionId" TEXT,
  ADD COLUMN "bankReference" TEXT;
