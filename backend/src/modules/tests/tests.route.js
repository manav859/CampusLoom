import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import {
  createTestHandler,
  submitResultsHandler,
  getTestsByClassHandler,
  getMyResultsHandler,
  getTestDetailsHandler,
} from './tests.controller.js';

const studentOnly = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.STUDENT])],
};

const teacherOnly = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN])],
};

const authenticated = {
  preHandler: [authenticate],
};

export default async function testsRoutes(fastify) {
  // Teacher/Admin
  fastify.post('/', teacherOnly, createTestHandler);
  fastify.post('/submit-results', teacherOnly, submitResultsHandler);
  fastify.get('/', teacherOnly, getTestsByClassHandler);
  fastify.get('/:id', teacherOnly, getTestDetailsHandler);

  // Student
  fastify.get('/my', studentOnly, getMyResultsHandler);
}
