import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import {
  markClassAttendanceHandler,
  getMyAttendanceHandler,
  getClassAttendanceHandler,
} from './attendance.controller.js';

const studentOnly = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.STUDENT])],
};

const teacherOnly = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN])],
};

export default async function attendanceRoutes(fastify) {
  // Teacher/Admin routes
  fastify.post('/', teacherOnly, markClassAttendanceHandler);
  fastify.get('/class', teacherOnly, getClassAttendanceHandler);

  // Student routes
  fastify.get('/my', studentOnly, getMyAttendanceHandler);
}
