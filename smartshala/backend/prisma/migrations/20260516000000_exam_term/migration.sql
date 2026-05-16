CREATE TYPE "ExamTerm" AS ENUM ('UNIT_TEST', 'MID_TERM', 'FINAL', 'TERM_1', 'TERM_2');

ALTER TABLE "exams" ADD COLUMN "term" "ExamTerm" NOT NULL DEFAULT 'UNIT_TEST';

CREATE INDEX "exams_schoolId_term_idx" ON "exams"("schoolId", "term");
