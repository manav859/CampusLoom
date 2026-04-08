import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../users/user.model.js';
import { Role } from '../roles/role.model.js';
import { getConfig } from '../../config/env.js';

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

export async function registerUser({ email, password }) {
  // Check if user already exists
  const existingUser = await User.findOne({ email }).lean();
  if (existingUser) {
    throw new Error('Email is already in use');
  }

  // Ensure 'ADMIN' and 'USER' roles exist (seed logic for first setup)
  let adminRole = await Role.findOne({ name: 'ADMIN' });
  let userRole = await Role.findOne({ name: 'USER' });

  if (!adminRole) {
    adminRole = await Role.create({ name: 'ADMIN', description: 'Administrator with full access' });
  }
  if (!userRole) {
    userRole = await Role.create({ name: 'USER', description: 'Standard user access' });
  }

  // If this is the absolute first user in the DB, make them ADMIN
  const userCount = await User.estimatedDocumentCount();
  const assignedRole = userCount === 0 ? adminRole : userRole;

  const hashedPassword = await hashPassword(password);

  const user = await User.create({
    email,
    password: hashedPassword,
    roleId: assignedRole._id,
  });

  return {
    id: user._id,
    email: user.email,
    role: assignedRole.name,
  };
}

export async function loginUser({ email, password }) {
  // Find user and explicitly select password to verify
  const user = await User.findOne({ email }).select('+password').populate('roleId').lean();
  
  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (!user.isActive) {
    throw new Error('User account is deactivated');
  }

  const isPasswordValid = await comparePassword(password, user.password);
  
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  const token = generateToken({
    userId: user._id,
    role: user.roleId?.name || null,
  });

  return {
    token,
    user: {
      id: user._id,
      email: user.email,
      role: user.roleId?.name || null,
    },
  };
}
