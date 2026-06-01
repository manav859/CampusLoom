-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "holidays_schoolId_date_key" ON "holidays"("schoolId", "date");

-- CreateIndex
CREATE INDEX "holidays_schoolId_date_idx" ON "holidays"("schoolId", "date");

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
