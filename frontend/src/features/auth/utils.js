/**
 * Utilities for Authentication and Role-based Logic.
 */

/**
 * Returns the default home path for a given user role.
 * 
 * @param {string} role - The user role (admin, teacher, student)
 * @returns {string} - The absolute path to the portal home
 */
export function getRoleHome(role) {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/teacher';
  return '/account'; // default for student or guest-like student access
}
