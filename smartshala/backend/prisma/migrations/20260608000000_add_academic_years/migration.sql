-- CreateEnum
CREATE TYPE "AcademicYearStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'CLOSED');

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "academicYearId" UUID;

-- AlterTable
ALTER TABLE "fee_structures" ADD COLUMN     "academicYearId" UUID;

-- CreateTable
CREATE TABLE "academic_years" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "status" "AcademicYearStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_years_schoolId_isCurrent_idx" ON "academic_years"("schoolId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_schoolId_name_key" ON "academic_years"("schoolId", "name");

-- CreateIndex
CREATE INDEX "classes_schoolId_academicYearId_idx" ON "classes"("schoolId", "academicYearId");

-- CreateIndex
CREATE INDEX "fee_structures_schoolId_academicYearId_idx" ON "fee_structures"("schoolId", "academicYearId");

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data backfill: derive AcademicYear rows from the existing free-text
-- academicYear strings on classes and fee_structures, then link the FKs and
-- mark the latest year per school as the current/active one.
-- ---------------------------------------------------------------------------

-- 1. Create one AcademicYear per distinct (schoolId, academicYear) string.
--    startDate = 1 Apr of the leading year, endDate = 31 Mar of the next year
--    (Indian academic calendar). Unparseable strings fall back to the current
--    calendar year.
INSERT INTO "academic_years" ("id", "schoolId", "name", "startDate", "endDate", "isCurrent", "status", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    y."schoolId",
    y."name",
    make_timestamp(y.start_year, 4, 1, 0, 0, 0),
    make_timestamp(y.start_year + 1, 3, 31, 0, 0, 0),
    false,
    'CLOSED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT
        src."schoolId",
        src."academicYear" AS "name",
        COALESCE(NULLIF(substring(src."academicYear" FROM '^\d{4}'), '')::int, EXTRACT(YEAR FROM CURRENT_DATE)::int) AS start_year
    FROM (
        SELECT "schoolId", "academicYear" FROM "classes"        WHERE "academicYear" IS NOT NULL AND "academicYear" <> ''
        UNION
        SELECT "schoolId", "academicYear" FROM "fee_structures" WHERE "academicYear" IS NOT NULL AND "academicYear" <> ''
    ) src
) y;

-- 2. Link classes and fee_structures to their AcademicYear row.
UPDATE "classes" c
SET "academicYearId" = ay."id"
FROM "academic_years" ay
WHERE ay."schoolId" = c."schoolId" AND ay."name" = c."academicYear" AND c."academicYearId" IS NULL;

UPDATE "fee_structures" f
SET "academicYearId" = ay."id"
FROM "academic_years" ay
WHERE ay."schoolId" = f."schoolId" AND ay."name" = f."academicYear" AND f."academicYearId" IS NULL;

-- 3. Mark the latest year (by startDate) per school as the current/active one.
UPDATE "academic_years" ay
SET "isCurrent" = true, "status" = 'ACTIVE'
FROM (
    SELECT DISTINCT ON ("schoolId") "id"
    FROM "academic_years"
    ORDER BY "schoolId", "startDate" DESC, "name" DESC
) latest
WHERE ay."id" = latest."id";
