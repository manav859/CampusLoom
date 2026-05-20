ALTER TABLE "schools"
ADD COLUMN "timetablePeriodCount" INTEGER NOT NULL DEFAULT 8;

ALTER TABLE "teacher_period_assignments"
ADD COLUMN "dayOfWeek" TEXT NOT NULL DEFAULT 'MONDAY';

DROP INDEX IF EXISTS "teacher_period_assignments_teacherId_periodNumber_key";

CREATE UNIQUE INDEX "teacher_period_assignments_teacherId_dayOfWeek_periodNumber_key"
ON "teacher_period_assignments"("teacherId", "dayOfWeek", "periodNumber");

CREATE INDEX "teacher_period_assignments_schoolId_dayOfWeek_periodNumber_classId_idx"
ON "teacher_period_assignments"("schoolId", "dayOfWeek", "periodNumber", "classId");
