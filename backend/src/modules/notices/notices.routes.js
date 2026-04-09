import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import {
  createNoticeHandler,
  deleteNoticeHandler,
  getNoticeByIdHandler,
  listNoticesHandler,
  listPublicNoticesHandler,
  updateNoticeHandler,
  updateNoticeStatusHandler,
} from './notices.controller.js';

export default async function noticesRoutes(fastify) {
  await fastify.register(
    async function adminNotices(admin) {
      admin.addHook('preHandler', authenticate);
      admin.addHook('preHandler', authorizeRoles(['ADMIN']));

      admin.get('/', listNoticesHandler);
      admin.get('/:id', getNoticeByIdHandler);
      admin.post('/', createNoticeHandler);
      admin.put('/:id', updateNoticeHandler);
      admin.delete('/:id', deleteNoticeHandler);
      admin.patch('/:id/status', updateNoticeStatusHandler);
    },
    { prefix: '/notices' },
  );

  await fastify.register(
    async function publicNotices(publicRoutes) {
      publicRoutes.get('/', listPublicNoticesHandler);
    },
    { prefix: '/public/notices' },
  );
}
