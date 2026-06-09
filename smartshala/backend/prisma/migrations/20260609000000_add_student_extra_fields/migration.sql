-- AlterTable
ALTER TABLE "students" ADD COLUMN     "aadhaar" TEXT,
ADD COLUMN     "apaar" TEXT,
ADD COLUMN     "previousSchool" TEXT,
ADD COLUMN     "siblingDiscount" BOOLEAN NOT NULL DEFAULT false;
