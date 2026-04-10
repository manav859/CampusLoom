import { authenticate, authenticateOptional, authorizeRoles } from '../../middleware/auth.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import {
  createAdmissionHandler,
  createAdmissionNoteHandler,
  getAdmissionByIdHandler,
  listAdmissionsHandler,
  updateAdmissionStatusHandler,
} from './admissions.controller.js';

const adminOnly = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.ADMIN])],
};

export default async function admissionsRoutes(fastify) {
  fastify.post('/', { preHandler: authenticateOptional }, createAdmissionHandler);

  fastify.get('/', adminOnly, listAdmissionsHandler);
  fastify.get('/:id', adminOnly, getAdmissionByIdHandler);
  fastify.patch('/:id/status', adminOnly, updateAdmissionStatusHandler);
  fastify.post('/:id/notes', adminOnly, createAdmissionNoteHandler);
}
