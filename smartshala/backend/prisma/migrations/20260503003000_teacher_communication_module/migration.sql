CREATE TYPE "CommunicationMessageType" AS ENUM ('ATTENDANCE_ALERT', 'HOMEWORK_REMINDER', 'CUSTOM');

ALTER TABLE "communication_logs"
ADD COLUMN "messageType" "CommunicationMessageType";
