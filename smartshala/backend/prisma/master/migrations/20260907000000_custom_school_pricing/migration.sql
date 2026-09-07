-- Negotiated per-school pricing. NULL keeps the school on the plan's list
-- price, which is the default for every existing and new subscription.
ALTER TABLE "subscriptions"
  ADD COLUMN "customPriceMinor" INTEGER,
  ADD COLUMN "customPriceNote" TEXT;
