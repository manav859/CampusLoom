import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import {
  uploadStudyMaterialHandler,
  listStudyMaterialsHandler,
  deleteStudyMaterialHandler,
} from './study-material.controller.js';

const studentOrTeacher = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.STUDENT, USER_ROLES.TEACHER, USER_ROLES.ADMIN])],
};

const teacherOnly = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN])],
};

export default async function studyMaterialRoutes(fastify) {
  fastify.post('/', teacherOnly, uploadStudyMaterialHandler);
  fastify.get('/', studentOrTeacher, listStudyMaterialsHandler);
  fastify.delete('/:id', teacherOnly, deleteStudyMaterialHandler);
}
