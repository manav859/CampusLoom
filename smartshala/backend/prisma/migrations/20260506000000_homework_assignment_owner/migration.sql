ALTER TABLE "homework_assignments"
ADD COLUMN "assignedById" UUID;

UPDATE "homework_assignments" AS "homework"
SET "assignedById" = COALESCE(
  (
    SELECT "subject"."teacherId"
    FROM "subjects" AS "subject"
    WHERE "subject"."id" = "homework"."subjectId"
  ),
  "class"."classTeacherId"
)
FROM "classes" AS "class"
WHERE "homework"."classId" = "class"."id"
  AND "homework"."assignedById" IS NULL;

ALTER TABLE "homework_assignments"
ADD CONSTRAINT "homework_assignments_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "homework_assignments_schoolId_assignedById_idx"
ON "homework_assignments"("schoolId", "assignedById");
