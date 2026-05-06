CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "teacher_period_assignments" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "teacherId" UUID NOT NULL,
  "periodNumber" INTEGER NOT NULL,
  "classId" UUID,
  "subjectId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "teacher_period_assignments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "teacher_period_assignments"
ADD CONSTRAINT "teacher_period_assignments_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "schools"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teacher_period_assignments"
ADD CONSTRAINT "teacher_period_assignments_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teacher_period_assignments"
ADD CONSTRAINT "teacher_period_assignments_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "classes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "teacher_period_assignments"
ADD CONSTRAINT "teacher_period_assignments_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "subjects"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "teacher_period_assignments_teacherId_periodNumber_key"
ON "teacher_period_assignments"("teacherId", "periodNumber");

CREATE INDEX "teacher_period_assignments_schoolId_teacherId_idx"
ON "teacher_period_assignments"("schoolId", "teacherId");

CREATE INDEX "teacher_period_assignments_schoolId_classId_idx"
ON "teacher_period_assignments"("schoolId", "classId");

CREATE INDEX "teacher_period_assignments_schoolId_subjectId_idx"
ON "teacher_period_assignments"("schoolId", "subjectId");

WITH teachers AS (
  SELECT
    teacher."schoolId",
    teacher."id" AS "teacherId",
    ROW_NUMBER() OVER (PARTITION BY teacher."schoolId" ORDER BY teacher."fullName", teacher."id") - 1 AS "teacherOffset"
  FROM "users" teacher
  WHERE teacher."role" = 'TEACHER'
    AND teacher."isActive" = true
),
assignments AS (
  SELECT
    class."schoolId",
    subject."classId",
    subject."id" AS "subjectId",
    ROW_NUMBER() OVER (PARTITION BY class."schoolId" ORDER BY class."name", class."section", subject."name", subject."id") AS "assignmentNumber",
    COUNT(*) OVER (PARTITION BY class."schoolId") AS "assignmentCount"
  FROM "classes" class
  JOIN "subjects" subject ON subject."classId" = class."id"
),
periods AS (
  SELECT generate_series(1, 7) AS "periodNumber"
)
INSERT INTO "teacher_period_assignments" ("id", "schoolId", "teacherId", "periodNumber", "classId", "subjectId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  teachers."schoolId",
  teachers."teacherId",
  periods."periodNumber",
  assignments."classId",
  assignments."subjectId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM teachers
JOIN periods ON true
JOIN assignments ON assignments."schoolId" = teachers."schoolId"
  AND assignments."assignmentNumber" = (((teachers."teacherOffset" * 7 + periods."periodNumber" - 1) % assignments."assignmentCount") + 1);

INSERT INTO "teacher_period_assignments" ("id", "schoolId", "teacherId", "periodNumber", "classId", "subjectId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), teacher."schoolId", teacher."id", 8, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" teacher
WHERE teacher."role" = 'TEACHER'
  AND teacher."isActive" = true
ON CONFLICT ("teacherId", "periodNumber") DO NOTHING;
