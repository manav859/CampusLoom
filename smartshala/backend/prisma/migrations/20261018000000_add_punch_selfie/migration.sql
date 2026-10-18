-- The selfie a teacher takes on the first punch-in of the day. Stored like
-- every other upload: a key into the configured provider, never the bytes.
-- All three stay nullable — a punch without a selfie is allowed on purpose,
-- so a denied camera can never lock a teacher out of marking attendance.

-- AlterTable
ALTER TABLE "staff_attendance" ADD COLUMN     "selfieKey" TEXT,
ADD COLUMN     "selfieMime" TEXT,
ADD COLUMN     "selfieProvider" TEXT;
