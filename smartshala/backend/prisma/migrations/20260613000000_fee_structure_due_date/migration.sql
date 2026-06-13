-- Add a single, authoritative due date to each fee structure.
ALTER TABLE "fee_structures" ADD COLUMN "dueDate" TIMESTAMP(3);

-- Backfill from the earliest existing installment due date.
UPDATE "fee_structures" fs
SET "dueDate" = sub.min_due
FROM (
  SELECT "feeStructureId", MIN("dueDate") AS min_due
  FROM "fee_installments"
  GROUP BY "feeStructureId"
) sub
WHERE sub."feeStructureId" = fs."id" AND fs."dueDate" IS NULL;

-- For any structure with no installments, fall back to its academic year end date.
UPDATE "fee_structures" fs
SET "dueDate" = ay."endDate"
FROM "academic_years" ay
WHERE fs."academicYearId" = ay."id" AND fs."dueDate" IS NULL;
