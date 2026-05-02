-- Add requested homework lifecycle status while preserving existing MISSING data.
ALTER TYPE "HomeworkSubmissionStatus" ADD VALUE IF NOT EXISTS 'NOT_SUBMITTED';

-- Add assignment description for teacher-created homework.
ALTER TABLE "homework_assignments" ADD COLUMN IF NOT EXISTS "description" TEXT;
