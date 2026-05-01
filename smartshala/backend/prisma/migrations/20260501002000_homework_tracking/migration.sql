CREATE TYPE "HomeworkSubmissionStatus" AS ENUM ('ON_TIME', 'LATE', 'MISSING');

CREATE TABLE "homework_assignments" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "subjectId" UUID,
    "subject" TEXT,
    "title" TEXT NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "maxMarks" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homework_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "homework_submissions" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "HomeworkSubmissionStatus" NOT NULL,
    "marks" DECIMAL(6,2),
    "teacherNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homework_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "homework_assignments_schoolId_classId_dueDate_idx" ON "homework_assignments"("schoolId", "classId", "dueDate");
CREATE INDEX "homework_assignments_schoolId_subjectId_idx" ON "homework_assignments"("schoolId", "subjectId");
CREATE UNIQUE INDEX "homework_submissions_assignmentId_studentId_key" ON "homework_submissions"("assignmentId", "studentId");
CREATE INDEX "homework_submissions_schoolId_studentId_status_idx" ON "homework_submissions"("schoolId", "studentId", "status");
CREATE INDEX "homework_submissions_schoolId_assignmentId_idx" ON "homework_submissions"("schoolId", "assignmentId");

ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "homework_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
