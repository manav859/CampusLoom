import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import { listUserAdmissionsHandler, listUserResultsHandler } from './user.controller.js';

export default async function userRoutes(fastify) {
  fastify.get('/admissions', {
    preHandler: [
      authenticate,
      authorizeRoles([USER_ROLES.STUDENT, USER_ROLES.TEACHER]),
    ],
    handler: listUserAdmissionsHandler,
  });

  fastify.get('/results', {
    preHandler: [
      authenticate,
      authorizeRoles([USER_ROLES.STUDENT, USER_ROLES.TEACHER]),
    ],
    handler: listUserResultsHandler,
  });
}
