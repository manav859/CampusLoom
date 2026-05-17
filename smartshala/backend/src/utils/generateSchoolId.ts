import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCandidateSchoolId(length = 8) {
  return Array.from({ length }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join("");
}

export async function generateUniqueSchoolId(exists: (schoolId: string) => Promise<boolean>, maxAttempts = 12) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const schoolId = generateCandidateSchoolId();
    if (!(await exists(schoolId))) return schoolId;
  }

  throw new Error("Unable to generate unique schoolId");
}

export function isValidSchoolId(value: string) {
  return /^[A-Z0-9]{8}$/.test(value);
}
