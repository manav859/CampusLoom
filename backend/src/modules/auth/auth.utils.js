import { normalizeRoleValue } from './auth.constants.js';

export function createAuthError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

export function normalizeName(value) {
  return value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}

export function resolveUserRole(user) {
  return normalizeRoleValue(user?.role) ?? normalizeRoleValue(user?.roleId?.name) ?? null;
}

function getSafeUserName(user) {
  const normalizedName = typeof user?.name === 'string' ? normalizeName(user.name) : '';

  if (normalizedName) {
    return normalizedName;
  }

  if (typeof user?.email === 'string' && user.email.includes('@')) {
    return user.email.split('@')[0];
  }

  return 'CampusLoom User';
}

export function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id?.toString?.() ?? user.id?.toString?.() ?? null,
    name: getSafeUserName(user),
    email: normalizeEmail(user.email),
    role: resolveUserRole(user),
    isActive: Boolean(user.isActive),
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
  };
}
