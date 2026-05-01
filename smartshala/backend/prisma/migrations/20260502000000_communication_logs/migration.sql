CREATE TYPE "CommunicationType" AS ENUM ('WHATSAPP', 'MANUAL_NOTE', 'CALL');

CREATE TYPE "CommunicationChannel" AS ENUM ('WHATSAPP', 'PHONE', 'IN_PERSON', 'INTERNAL');

CREATE TYPE "CommunicationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'COMPLETED', 'MISSED', 'NOTE');

CREATE TABLE "communication_logs" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "type" "CommunicationType" NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "CommunicationStatus" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "communication_logs_schoolId_studentId_timestamp_idx" ON "communication_logs"("schoolId", "studentId", "timestamp");
CREATE INDEX "communication_logs_schoolId_type_channel_idx" ON "communication_logs"("schoolId", "type", "channel");

ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
