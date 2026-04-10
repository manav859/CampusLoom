import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import { getDashboardStatsHandler } from './dashboard.controller.js';

export default async function dashboardRoutes(fastify) {
  fastify.get(
    '/stats',
    {
      preHandler: [authenticate, authorizeRoles([USER_ROLES.ADMIN])],
    },
    getDashboardStatsHandler,
  );
}
