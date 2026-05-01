-- CreateEnum
CREATE TYPE "BehaviourType" AS ENUM ('INCIDENT', 'ACHIEVEMENT', 'COUNSELLOR_NOTE');

-- CreateEnum
CREATE TYPE "BehaviourSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'POSITIVE', 'NOTE');

-- CreateTable
CREATE TABLE "behaviour_records" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "createdById" UUID,
    "type" "BehaviourType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" "BehaviourSeverity" NOT NULL DEFAULT 'LOW',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRestricted" BOOLEAN NOT NULL DEFAULT false,
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "behaviour_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "behaviour_records_schoolId_studentId_occurredAt_idx" ON "behaviour_records"("schoolId", "studentId", "occurredAt");

-- CreateIndex
CREATE INDEX "behaviour_records_schoolId_type_idx" ON "behaviour_records"("schoolId", "type");

-- AddForeignKey
ALTER TABLE "behaviour_records" ADD CONSTRAINT "behaviour_records_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behaviour_records" ADD CONSTRAINT "behaviour_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behaviour_records" ADD CONSTRAINT "behaviour_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
