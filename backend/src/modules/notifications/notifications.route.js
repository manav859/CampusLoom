import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import {
  createNotificationHandler,
  getMyNotificationsHandler,
  markAsReadHandler,
} from './notifications.controller.js';

const adminOnly = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.ADMIN])],
};

const authenticated = {
  preHandler: [authenticate],
};

export default async function notificationsRoutes(fastify) {
  fastify.get('/my', authenticated, getMyNotificationsHandler);
  fastify.patch('/:id/read', authenticated, markAsReadHandler);
  
  // Admin only
  fastify.post('/', adminOnly, createNotificationHandler);
}
