-- The 2026 price list: four yearly tiers, told apart by how many students the
-- school has. Enterprise carries the "from" price; sales quotes the real figure
-- on the proforma.
INSERT INTO "plans" ("code", "name", "description", "priceMinor", "interval", "trialDays", "maxStudents", "maxStaff", "features", "isPublic", "sortOrder")
VALUES
  ('STARTER', 'Starter', 'For small schools, up to 300 students.', 999900, 'YEAR', 0, 300, NULL,
   '{"attendance":true,"fees":true,"marks":true,"reports":true,"whatsapp":true,"analytics":true,"chatbot":true}', true, 10),
  ('GROWTH', 'Growth', 'For growing schools, 301 to 700 students.', 1499900, 'YEAR', 0, 700, NULL,
   '{"attendance":true,"fees":true,"marks":true,"reports":true,"whatsapp":true,"analytics":true,"chatbot":true}', true, 20),
  ('PREMIUM', 'Premium', 'For larger schools, 701 to 1,500 students.', 2499900, 'YEAR', 0, 1500, NULL,
   '{"attendance":true,"fees":true,"marks":true,"reports":true,"whatsapp":true,"analytics":true,"chatbot":true}', true, 30),
  ('ENTERPRISE', 'Enterprise', 'Multi-campus or custom needs, from 1,501 students. Priced on quote.', 3999900, 'YEAR', 0, NULL, NULL,
   '{"attendance":true,"fees":true,"marks":true,"reports":true,"whatsapp":true,"analytics":true,"chatbot":true}', true, 40)
ON CONFLICT ("code") DO NOTHING;

-- The old single paid plan is retired rather than deleted: schools already on it
-- keep their subscription, invoices and renewal history. It just stops being
-- offered to a principal or quotable from the CRM.
UPDATE "plans" SET "isActive" = false, "isPublic" = false WHERE "code" = 'STANDARD';
