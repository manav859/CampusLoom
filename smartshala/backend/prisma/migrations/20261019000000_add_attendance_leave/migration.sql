-- A student who told the school they would be away. It is an excused
-- absence, not a kind of attendance: attendanceValue stays 0, so every
-- percentage already in the database keeps its meaning. It is a separate
-- status only so a school can tell "told us" from "did not turn up".

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'LEAVE';
