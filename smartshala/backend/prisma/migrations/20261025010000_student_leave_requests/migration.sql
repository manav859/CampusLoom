-- Parent-raised leave/absence requests for a child (Parent app, Phase 7a).
-- Separate from leave_requests (staff leave, keyed to a User): the applicant is
-- a parent with no User row, so the submitter is kept by phone + name, and the
-- subject is a student. LeaveStatus (PENDING/APPROVED/REJECTED/CANCELLED) is
-- reused from the staff flow.

-- CreateTable
CREATE TABLE "student_leave_requests" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByPhone" VARCHAR(10) NOT NULL,
    "requestedByName" TEXT,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_leave_requests_schoolId_status_createdAt_idx" ON "student_leave_requests"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "student_leave_requests_schoolId_studentId_createdAt_idx" ON "student_leave_requests"("schoolId", "studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
