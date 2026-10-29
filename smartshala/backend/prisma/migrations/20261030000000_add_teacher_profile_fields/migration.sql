-- Optional HR/profile fields on a user, used by the teacher add form and the
-- teacher CSV import. All nullable so existing rows and other roles are
-- untouched. `gender` reuses the existing Gender enum (MALE/FEMALE/OTHER).

-- AlterTable
ALTER TABLE "users" ADD COLUMN "gender" "Gender";
ALTER TABLE "users" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "joiningDate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "designation" TEXT;
ALTER TABLE "users" ADD COLUMN "address" TEXT;
ALTER TABLE "users" ADD COLUMN "emergencyContact" TEXT;
