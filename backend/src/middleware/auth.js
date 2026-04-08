import jwt from 'jsonwebtoken';
import { User } from '../modules/users/user.model.js';
import { getConfig } from '../config/env.js';

/**
 * Middleware to verify JWT, attach user to request, and protect routes.
 */
export async function authenticate(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

    // Attach user payload to the request
    request.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.roleId?.name || null,
    };
  } catch (error) {
    request.log.warn({ err: error }, 'Authentication error');
    return reply.unauthorized('Invalid or expired token');
  }
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
