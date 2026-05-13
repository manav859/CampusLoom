-- Hot-path indexes for workspace boot, dashboard summaries, and parent lookups.
CREATE INDEX "students_schoolId_parentPhone_idx" ON "students"("schoolId", "parentPhone");
CREATE INDEX "students_schoolId_alternatePhone_idx" ON "students"("schoolId", "alternatePhone");
CREATE INDEX "behaviour_records_schoolId_type_severity_occurredAt_idx" ON "behaviour_records"("schoolId", "type", "severity", "occurredAt");
CREATE INDEX "attendance_records_schoolId_status_idx" ON "attendance_records"("schoolId", "status");
CREATE INDEX "notifications_schoolId_createdAt_idx" ON "notifications"("schoolId", "createdAt");
