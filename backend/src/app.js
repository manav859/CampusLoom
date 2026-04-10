import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';

import { getConfig } from './config/env.js';
import { buildLoggerConfig } from './plugins/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import mongoosePlugin from './plugins/mongoose.js';
import { API_PREFIX } from './common/constants.js';

// --- Module route imports ---
import healthRoute from './modules/health/health.route.js';
import authRoutes from './modules/auth/auth.route.js';
import userRoutes from './modules/user/user.route.js';
import usersRoutes from './modules/users/users.route.js';
import pagesRoutes from './modules/pages/pages.routes.js';
import mediaRoutes from './modules/media/media.route.js';
import noticesRoutes from './modules/notices/notices.route.js';
import eventsRoutes from './modules/events/events.route.js';
import admissionsRoutes from './modules/admissions/admissions.route.js';
import studentsRoutes from './modules/students/students.route.js';
import facultyRoutes from './modules/faculty/faculty.route.js';
import galleryRoutes from './modules/gallery/gallery.route.js';
import resultsRoutes from './modules/results/results.route.js';
import dashboardRoutes from './modules/dashboard/dashboard.route.js';
import auditLogsRoutes from './modules/audit-logs/audit-logs.route.js';
import settingsRoutes from './modules/settings/settings.route.js';

/**
 * Build and configure the Fastify application.
 *
 * This function is separated from server.js so the app can be
 * imported independently for testing without starting the server.
 */
export async function buildApp() {
  const config = getConfig();

  const app = Fastify({
    logger: buildLoggerConfig(config.NODE_ENV),
    disableRequestLogging: true,
    // Disable the default x-powered-by header
    exposeHeadRoutes: false,
  });

  // --- Attach validated config to the Fastify instance ---
  app.decorate('config', config);

  // --- Global error handler ---
  app.setErrorHandler(errorHandler);

  // --- Core plugins ---
  await app.register(sensible);

  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.register(mongoosePlugin);

  // --- API v1 routes ---
  await app.register(
    async function v1Routes(v1) {
      await v1.register(healthRoute);
      await v1.register(authRoutes, { prefix: '/auth' });
      await v1.register(userRoutes, { prefix: '/user' });
      await v1.register(usersRoutes, { prefix: '/users' });
      await v1.register(pagesRoutes);
      await v1.register(mediaRoutes, { prefix: '/media' });
      await v1.register(noticesRoutes);
      await v1.register(eventsRoutes, { prefix: '/events' });
      await v1.register(admissionsRoutes, { prefix: '/admissions' });
      await v1.register(studentsRoutes, { prefix: '/students' });
      await v1.register(facultyRoutes, { prefix: '/faculty' });
      await v1.register(galleryRoutes, { prefix: '/gallery' });
      await v1.register(resultsRoutes, { prefix: '/results' });
      await v1.register(dashboardRoutes, { prefix: '/dashboard' });
      await v1.register(auditLogsRoutes, { prefix: '/audit-logs' });
      await v1.register(settingsRoutes, { prefix: '/settings' });
    },
    { prefix: API_PREFIX },
  );

  return app;
}
