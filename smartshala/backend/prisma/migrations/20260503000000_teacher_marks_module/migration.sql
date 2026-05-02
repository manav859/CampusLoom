-- Extend exams so teacher-created exams carry subject and max marks.
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "subjectId" UUID;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "maxMarks" DECIMAL(6, 2);

-- Store computed result snapshot values while preserving existing analytics.
ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "percentage" DECIMAL(5, 2);
ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "grade" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exams_schoolId_subjectId_idx" ON "exams"("schoolId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "exam_results_studentId_examId_key" ON "exam_results"("studentId", "examId");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
