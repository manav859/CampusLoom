/**
 * Parents sign in by mobile number, and a student can carry that number in any
 * of several guardian fields. These helpers match a login mobile against a
 * student the same way everywhere — at login, in the children list, and in the
 * student access filter — so a parent sees exactly the children they can reach.
 */

/** The guardian phone fields a parent can be reached through on a Student. */
export const GUARDIAN_PHONE_FIELDS = [
  "parentPhone",
  "alternatePhone",
  "fatherPhone",
  "motherPhone",
  "guardianPhone",
] as const;

/** The last ten digits of a phone, ignoring spaces, punctuation and a country code. */
export function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * The spellings a 10-digit Indian mobile is commonly stored as, so an
 * exact-match query still finds it. Used where SQL cannot normalize a column.
 */
export function phoneVariants(value: string | null | undefined): string[] {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 0) return [];
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  if (ten.length !== 10) return [ten];
  return [ten, `0${ten}`, `91${ten}`, `+91${ten}`, `91 ${ten}`, `+91 ${ten}`];
}

/** True when any guardian phone on this student is the given mobile. Exact on digits. */
export function studentMatchesPhone(
  student: Partial<Record<(typeof GUARDIAN_PHONE_FIELDS)[number], string | null>>,
  mobile: string
): boolean {
  const target = normalizePhone(mobile);
  if (target.length !== 10) return false;
  return GUARDIAN_PHONE_FIELDS.some((field) => normalizePhone(student[field]) === target);
}

/**
 * A Prisma `where` fragment selecting students any of whose guardian phones is
 * this mobile. An unusable number yields a filter that matches nothing rather
 * than everything.
 */
export function parentStudentWhere(mobile: string) {
  const variants = phoneVariants(mobile);
  if (variants.length === 0) return { parentPhone: "__NO_PARENT_PHONE__" };
  return { OR: GUARDIAN_PHONE_FIELDS.map((field) => ({ [field]: { in: variants } })) };
}
