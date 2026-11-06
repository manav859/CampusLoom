-- The top of the price list is not a price anyone can just pay: above the
-- largest capped tier, sales quotes the figure. Marking it in the plan's own
-- feature map keeps that fact in the catalogue rather than in the code, so the
-- upgrade prompt knows to say "contact us" instead of offering a checkout.
UPDATE "plans"
SET "features" = "features" || '{"customPricing": true}'::jsonb
WHERE "code" = 'ENTERPRISE';

-- Reassert the 2026 price list, in case a tier was edited by hand while the
-- tiers were not yet enforced anywhere.
UPDATE "plans" SET "priceMinor" = 999900,  "maxStudents" = 300  WHERE "code" = 'STARTER';
UPDATE "plans" SET "priceMinor" = 1499900, "maxStudents" = 700  WHERE "code" = 'GROWTH';
UPDATE "plans" SET "priceMinor" = 2499900, "maxStudents" = 1500 WHERE "code" = 'PREMIUM';
UPDATE "plans" SET "maxStudents" = NULL WHERE "code" = 'ENTERPRISE';
