-- CreateTable
CREATE TABLE "period_times" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "period_times_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "period_times_schoolId_periodNumber_key" ON "period_times"("schoolId", "periodNumber");

-- AddForeignKey
ALTER TABLE "period_times" ADD CONSTRAINT "period_times_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
