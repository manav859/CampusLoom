import { ZodError } from 'zod';
import { sendError, sendSuccess } from '../../utils/response.js';
import {
  studentIdParamSchema,
  listStudentsQuerySchema,
} from './students.schema.js';
import {
  listStudents,
  getStudentById,
  deleteStudent,
} from './students.service.js';

function handleStudentsError(error, request, reply, fallbackMessage) {
  if (error instanceof ZodError) {
    return sendError(reply, 400, 'Validation failed', error.issues);
  }

  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? fallbackMessage : error.message;

  if (statusCode >= 500) {
    request.log.error(error);
  }

  return sendError(reply, statusCode, message);
}

export async function listStudentsHandler(request, reply) {
  try {
    const filters = listStudentsQuerySchema.parse(request.query);
    const students = await listStudents(filters);

    return sendSuccess(reply, 200, students, 'Students fetched successfully');
  } catch (error) {
    return handleStudentsError(error, request, reply, 'Failed to fetch students');
  }
}

export async function getStudentByIdHandler(request, reply) {
  try {
    const { id } = studentIdParamSchema.parse(request.params);
    const student = await getStudentById(id);

    return sendSuccess(reply, 200, student, 'Student fetched successfully');
  } catch (error) {
    return handleStudentsError(error, request, reply, 'Failed to fetch student');
  }
}

export async function deleteStudentHandler(request, reply) {
  try {
    const { id } = studentIdParamSchema.parse(request.params);
    const result = await deleteStudent(id);

    return sendSuccess(reply, 200, result, 'Student deleted successfully');
  } catch (error) {
    return handleStudentsError(error, request, reply, 'Failed to delete student');
  }
}
