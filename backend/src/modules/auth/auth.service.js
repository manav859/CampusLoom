import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../users/user.model.js';
import { getConfig } from '../../config/env.js';
import { isPublicRegistrationRole } from './auth.constants.js';
import {
  createAuthError,
  normalizeEmail,
  normalizeName,
  resolveUserRole,
  sanitizeUser,
} from './auth.utils.js';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload) {
  const { JWT_SECRET } = getConfig();
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export async function registerUser({ name, email, password, role }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = resolveUserRole({ role });

  if (!isPublicRegistrationRole(normalizedRole)) {
    throw createAuthError(400, 'Public registration is limited to student and teacher accounts');
  }

  const existingUser = await User.findOne({ email: normalizedEmail }).select('_id').lean();
  if (existingUser) {
    throw createAuthError(409, 'Email is already in use');
  }

  const hashedPassword = await hashPassword(password);

  const user = await User.create({
    name: normalizeName(name),
    email: normalizedEmail,
    password: hashedPassword,
    role: normalizedRole,
  });

  return sanitizeUser(user);
}

export async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail }).select('+password').populate('roleId').lean();

  if (!user) {
    throw createAuthError(401, 'Invalid credentials');
  }

  if (!user.isActive) {
    throw createAuthError(401, 'User account is deactivated');
  }

  const isPasswordValid = await comparePassword(password, user.password);

  if (!isPasswordValid) {
    throw createAuthError(401, 'Invalid credentials');
  }

  const role = resolveUserRole(user);

  if (!role) {
    throw createAuthError(403, 'User account role is invalid');
  }

  const token = generateToken({
    userId: user._id,
    role,
  });

  return {
    token,
    user: sanitizeUser({ ...user, role }),
  };
}
