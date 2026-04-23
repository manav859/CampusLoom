CREATE INDEX "fee_structures_schoolId_classId_idx" ON "fee_structures"("schoolId", "classId");

CREATE INDEX "student_fee_assignments_schoolId_studentId_status_idx" ON "student_fee_assignments"("schoolId", "studentId", "status");

CREATE INDEX "payments_schoolId_studentId_paidAt_idx" ON "payments"("schoolId", "studentId", "paidAt");
