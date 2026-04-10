import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import {
  listStudentsHandler,
  getStudentByIdHandler,
  deleteStudentHandler,
} from './students.controller.js';

const adminOnly = {
  preHandler: [authenticate, authorizeRoles([USER_ROLES.ADMIN])],
};

export default async function studentsRoutes(fastify) {
  fastify.get('/', adminOnly, listStudentsHandler);
  fastify.get('/:id', adminOnly, getStudentByIdHandler);
  fastify.delete('/:id', adminOnly, deleteStudentHandler);
}
