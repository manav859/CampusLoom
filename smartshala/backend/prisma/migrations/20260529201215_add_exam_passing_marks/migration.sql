-- AlterEnum
ALTER TYPE "ExamTerm" ADD VALUE 'CLASS_TEST';

-- AlterEnum
ALTER TYPE "FeeFrequency" ADD VALUE 'BIANNUAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StudentDocumentType" ADD VALUE 'AADHAAR';
ALTER TYPE "StudentDocumentType" ADD VALUE 'APAAR';
ALTER TYPE "StudentDocumentType" ADD VALUE 'BIRTH_CERTIFICATE';
ALTER TYPE "StudentDocumentType" ADD VALUE 'CASTE_CERTIFICATE';
ALTER TYPE "StudentDocumentType" ADD VALUE 'TRANSFER_CERTIFICATE';
ALTER TYPE "StudentDocumentType" ADD VALUE 'BONAFIDE';
ALTER TYPE "StudentDocumentType" ADD VALUE 'REPORT_CARD';
ALTER TYPE "StudentDocumentType" ADD VALUE 'PHOTO';

-- AlterTable
ALTER TABLE "exam_results" ADD COLUMN     "isAbsent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "description" TEXT,
ADD COLUMN     "passingMarks" DECIMAL(6,2);

-- AlterTable
ALTER TABLE "fee_adjustments" ALTER COLUMN "id" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "teacher_period_assignments_schoolId_dayOfWeek_periodNumber_clas" RENAME TO "teacher_period_assignments_schoolId_dayOfWeek_periodNumber__idx";
