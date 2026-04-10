import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import { getStudentDashboardHandler, getTeacherDashboardHandler } from './dashboard.controller.js';

export default async function dashboardRoutes(fastify) {
  fastify.get('/student', { 
    preHandler: [authenticate, authorizeRoles([USER_ROLES.STUDENT])] 
  }, getStudentDashboardHandler);

  fastify.get('/teacher', { 
    preHandler: [authenticate, authorizeRoles([USER_ROLES.TEACHER])] 
  }, getTeacherDashboardHandler);
}
