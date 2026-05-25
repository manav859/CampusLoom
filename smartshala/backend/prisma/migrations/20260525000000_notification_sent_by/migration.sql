ALTER TABLE "notifications" ADD COLUMN "sentById" UUID;

CREATE INDEX "notifications_schoolId_sentById_createdAt_idx" ON "notifications"("schoolId", "sentById", "createdAt");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
