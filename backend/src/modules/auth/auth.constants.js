export const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  STUDENT: 'student',
  TEACHER: 'teacher',
});

export const PUBLIC_REGISTRATION_ROLES = Object.freeze([
  USER_ROLES.STUDENT,
  USER_ROLES.TEACHER,
]);

const ROLE_ALIASES = new Map([
  ['ADMIN', USER_ROLES.ADMIN],
  ['admin', USER_ROLES.ADMIN],
  ['USER', USER_ROLES.STUDENT],
  ['user', USER_ROLES.STUDENT],
  ['STUDENT', USER_ROLES.STUDENT],
  ['student', USER_ROLES.STUDENT],
  ['TEACHER', USER_ROLES.TEACHER],
  ['teacher', USER_ROLES.TEACHER],
]);

export function normalizeRoleValue(role) {
  if (typeof role !== 'string') {
    return null;
  }

  return ROLE_ALIASES.get(role.trim()) ?? ROLE_ALIASES.get(role.trim().toLowerCase()) ?? null;
}

export function isPublicRegistrationRole(role) {
  return PUBLIC_REGISTRATION_ROLES.includes(normalizeRoleValue(role));
}
