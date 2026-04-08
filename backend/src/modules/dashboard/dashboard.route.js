import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { getDashboardStatsHandler } from './dashboard.controller.js';

export default async function dashboardRoutes(fastify) {
  fastify.get(
    '/stats',
    {
      preHandler: [authenticate, authorizeRoles(['ADMIN'])],
    },
    getDashboardStatsHandler,
  );
}
