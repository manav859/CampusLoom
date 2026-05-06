ALTER TABLE "subjects"
ADD COLUMN "teacherId" UUID;

UPDATE "subjects" AS "subject"
SET "teacherId" = "class"."classTeacherId"
FROM "classes" AS "class"
WHERE "subject"."classId" = "class"."id"
  AND "subject"."teacherId" IS NULL
  AND "class"."classTeacherId" IS NOT NULL;

ALTER TABLE "subjects"
ADD CONSTRAINT "subjects_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "subjects_schoolId_teacherId_idx" ON "subjects"("schoolId", "teacherId");
