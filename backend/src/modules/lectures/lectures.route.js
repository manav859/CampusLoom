import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import {
  createLectureHandler,
  listLecturesHandler,
  deleteLectureHandler,
} from './lectures.controller.js';

const studentOrTeacher = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.STUDENT, USER_ROLES.TEACHER, USER_ROLES.ADMIN])],
};

const teacherOnly = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN])],
};

export default async function lecturesRoutes(fastify) {
  fastify.post('/', teacherOnly, createLectureHandler);
  fastify.get('/', studentOrTeacher, listLecturesHandler);
  fastify.delete('/:id', teacherOnly, deleteLectureHandler);
}
