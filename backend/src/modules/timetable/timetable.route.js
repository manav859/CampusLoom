import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import {
  createTimetableEntryHandler,
  getTimetableHandler,
  getMyTimetableHandler,
  deleteTimetableEntryHandler,
} from './timetable.controller.js';

const adminOnly = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.ADMIN])],
};

const authenticated = {
  preHandler: [authenticate],
};

export default async function timetableRoutes(fastify) {
  // Public/Authenticated view
  fastify.get('/', authenticated, getTimetableHandler);
  fastify.get('/my', authenticated, getMyTimetableHandler);

  // Admin only management
  fastify.post('/', adminOnly, createTimetableEntryHandler);
  fastify.delete('/:id', adminOnly, deleteTimetableEntryHandler);
}
