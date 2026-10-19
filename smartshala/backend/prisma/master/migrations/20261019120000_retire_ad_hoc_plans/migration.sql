-- Only the four published tiers are on sale. Anything else that accumulated in
-- the catalogue — plans added by hand through the super admin panel, and the
-- old Standard — is retired rather than deleted, because schools are already
-- subscribed to some of them and their invoices and proformas point at the row.
-- Retiring takes a plan out of every list; deleting would take the billing
-- history with it.
--
-- TRIAL is deliberately spared: it is not a price on the list but the plan every
-- new school is put on for its first 30 days.
UPDATE "plans"
SET "isActive" = false, "isPublic" = false
WHERE "code" NOT IN ('STARTER', 'GROWTH', 'PREMIUM', 'ENTERPRISE', 'TRIAL');
