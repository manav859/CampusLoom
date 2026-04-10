import jwt from 'jsonwebtoken';
import { User } from '../modules/users/user.model.js';
import { getConfig } from '../config/env.js';
import { resolveUserRole, sanitizeUser } from '../modules/auth/auth.utils.js';

/**
 * Middleware to verify JWT, attach user to request, and protect routes.
 */
async function authenticateRequest(request, reply, { allowAnonymous = false } = {}) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (allowAnonymous) {
        request.user = null;
        return;
      }

      return reply.unauthorized('No authorization token provided');
    }

    const token = authHeader.split(' ')[1];
    const { JWT_SECRET } = getConfig();

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch user and check if they still exist and are active
    const user = await User.findById(decoded.userId).populate('roleId').lean();

    if (!user) {
      return reply.unauthorized('Invalid or expired token');
    }

    if (!user.isActive) {
      return reply.unauthorized('Account is deactivated');
    }

    const role = resolveUserRole(user);

    if (!role) {
      return reply.unauthorized('Invalid or expired token');
    }

    request.user = sanitizeUser({ ...user, role });
  } catch (error) {
    request.log.warn({ err: error }, 'Authentication error');
    return reply.unauthorized('Invalid or expired token');
  }
}

export async function authenticate(request, reply) {
  return authenticateRequest(request, reply);
}

export async function authenticateOptional(request, reply) {
  return authenticateRequest(request, reply, { allowAnonymous: true });
}

/**
 * Higher-order middleware to enforce RBAC based on user roles.
 * Ensure to use `authenticate` before using this.
 * @param {string[]} allowedRoles - Array of allowed role names (e.g., ['ADMIN', 'EDITOR'])
 */
export function authorizeRoles(allowedRoles) {
  return async (request, reply) => {
    if (!request.user || !request.user.role) {
      return reply.forbidden('Role not assigned');
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.forbidden('Insufficient permissions');
    }
  };
}
