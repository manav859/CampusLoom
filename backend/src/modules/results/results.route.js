import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import {
  createResultHandler,
  getStudentResultsHandler,
} from './results.controller.js';

const adminOnly = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.ADMIN])],
};

export default async function resultsRoutes(fastify) {
  fastify.post('/', adminOnly, createResultHandler);
  fastify.get('/:studentId', adminOnly, getStudentResultsHandler);
}
