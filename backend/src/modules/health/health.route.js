import { sendSuccess } from '../../utils/response.js';

/**
 * Health-check route plugin.
 *
 * GET /api/v1/health
 */
export default async function healthRoute(fastify) {
  fastify.get('/health', async (_request, reply) => {
    return sendSuccess(reply, 200, {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }, 'CampusLoom API running');
  });
}
