-- Multiple punches per day (breaks, undoing a mistaken punch-out), event times,
-- and the shifts and pay profiles payroll calculates from.

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "endTime" VARCHAR(5),
ADD COLUMN     "startTime" VARCHAR(5);

-- CreateTable
CREATE TABLE "staff_attendance_sessions" (
    "id" UUID NOT NULL,
    "attendanceId" UUID NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_shifts" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_pay_profiles" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "shiftId" UUID,
    "monthlySalary" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pay_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_attendance_sessions_attendanceId_startAt_idx" ON "staff_attendance_sessions"("attendanceId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "staff_shifts_schoolId_name_key" ON "staff_shifts"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_pay_profiles_userId_key" ON "staff_pay_profiles"("userId");

-- CreateIndex
CREATE INDEX "staff_pay_profiles_schoolId_idx" ON "staff_pay_profiles"("schoolId");

-- AddForeignKey
ALTER TABLE "staff_attendance_sessions" ADD CONSTRAINT "staff_attendance_sessions_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "staff_attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_pay_profiles" ADD CONSTRAINT "staff_pay_profiles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_pay_profiles" ADD CONSTRAINT "staff_pay_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_pay_profiles" ADD CONSTRAINT "staff_pay_profiles_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "staff_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Every day punched before this migration becomes one session, so worked
-- time and history read the same as they did.
INSERT INTO "staff_attendance_sessions" ("id", "attendanceId", "startAt", "endAt", "createdAt")
SELECT gen_random_uuid(), "id", "punchInAt", "punchOutAt", "createdAt" FROM "staff_attendance";
