import { isValidSchoolId } from "../utils/generateSchoolId.js";

export function legacyTenantSchoolId(school: { id: string; code?: string | null }) {
  const code = school.code?.trim().toUpperCase();
  if (code && isValidSchoolId(code)) return code;

  return school.id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
}
