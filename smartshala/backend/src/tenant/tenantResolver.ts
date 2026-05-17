import { env } from "../config/env.js";
import { AppError } from "../core/errors.js";
import { masterPrisma } from "../master-db/masterPrisma.js";
import { isValidSchoolId } from "../utils/generateSchoolId.js";

export async function resolveTenant(schoolId: string) {
  if (!isValidSchoolId(schoolId)) {
    throw new AppError(400, "Invalid school ID", "INVALID_SCHOOL_ID");
  }

  if (!env.MASTER_DATABASE_URL) {
    throw new AppError(503, "Master database is not configured", "MASTER_DB_NOT_CONFIGURED");
  }

  const school = await masterPrisma.school.findUnique({ where: { schoolId } });
  if (!school) throw new AppError(404, "School not found", "SCHOOL_NOT_FOUND");

  const trialExpired = Boolean(school.isTrial && school.trialEndsAt && school.trialEndsAt <= new Date());
  if (!school.isActive || trialExpired) {
    throw new AppError(402, "School subscription is inactive or expired", "SCHOOL_INACTIVE");
  }

  return school;
}
