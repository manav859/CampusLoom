/**
 * Application-wide constants.
 *
 * Keep module-specific constants inside their own modules;
 * only truly global values belong here.
 */

/** Current API version prefix */
export const API_PREFIX = '/api/v1';

/** Role keys — used for RBAC (implemented in Phase 2) */
export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  SCHOOL_ADMIN: 'school_admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  PARENT: 'parent',
});

/** Pagination defaults */
export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});
