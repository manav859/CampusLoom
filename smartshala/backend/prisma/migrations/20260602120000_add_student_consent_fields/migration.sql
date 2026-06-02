-- AlterTable
ALTER TABLE "students" ADD COLUMN     "consentGiven" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentGivenAt" TIMESTAMP(3),
ADD COLUMN     "consentGivenBy" TEXT,
ADD COLUMN     "consentMethod" TEXT;
