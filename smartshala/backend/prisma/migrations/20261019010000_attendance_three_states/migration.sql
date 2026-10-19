-- Attendance is three states and no more: the student came, did not come, or
-- was excused. LATE and HALF_DAY are gone.
--
-- Both existing statuses fold into PRESENT. LATE already counted as a full
-- day, so nothing moves for it. HALF_DAY was worth 0.50, so its rows are
-- promoted to a whole day and the stored value is squared up with the status —
-- without that, a PRESENT row would still be worth half a day and every
-- percentage read from status alone would disagree with one read from the
-- value.
UPDATE "attendance_records"
SET "status" = 'PRESENT', "attendanceValue" = 1.00
WHERE "status" IN ('LATE', 'HALF_DAY');

-- Postgres cannot drop a value from an enum, so the type is rebuilt. The
-- column swap rebuilds attendance_records_schoolId_status_idx with it.
ALTER TYPE "AttendanceStatus" RENAME TO "AttendanceStatus_old";
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE');
ALTER TABLE "attendance_records"
  ALTER COLUMN "status" TYPE "AttendanceStatus" USING ("status"::text::"AttendanceStatus");
DROP TYPE "AttendanceStatus_old";
