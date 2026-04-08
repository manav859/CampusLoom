import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import {
  createPageHandler,
  deletePageHandler,
  getPublicPageBySlugHandler,
  listPagesHandler,
  updatePageHandler,
  updatePageStatusHandler,
} from './pages.controller.js';

export default async function pagesRoutes(fastify) {
  await fastify.register(
    async function adminPages(admin) {
      admin.addHook('preHandler', authenticate);
      admin.addHook('preHandler', authorizeRoles(['ADMIN']));

      admin.get('/', listPagesHandler);
      admin.post('/', createPageHandler);
      admin.put('/:id', updatePageHandler);
      admin.delete('/:id', deletePageHandler);
      admin.patch('/:id/status', updatePageStatusHandler);
    },
    { prefix: '/pages' },
  );

  await fastify.register(
    async function publicPages(publicRoutes) {
      publicRoutes.get('/:slug', getPublicPageBySlugHandler);
    },
    { prefix: '/public/pages' },
  );
}
