-- Push notification targets for the two mobile apps. One row per app install,
-- keyed by the Firebase Installation ID the app reports: FCM has deprecated the
-- registration token in favour of it, and `fid` is the field the HTTP v1 send
-- API takes. The unique index is what lets a FID be reassigned to whoever signs
-- in on that device rather than duplicated.

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "device_registrations" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fid" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_registrations_fid_key" ON "device_registrations"("fid");

-- CreateIndex
CREATE INDEX "device_registrations_schoolId_userId_idx" ON "device_registrations"("schoolId", "userId");

-- AddForeignKey
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
