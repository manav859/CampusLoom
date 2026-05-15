ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'HALF_DAY';

ALTER TABLE "attendance_records"
  ADD COLUMN "attendanceValue" DECIMAL(3, 2) NOT NULL DEFAULT 1.00;

UPDATE "attendance_records"
SET "attendanceValue" = CASE
  WHEN "status" = 'ABSENT' THEN 0.00
  ELSE 1.00
END;
