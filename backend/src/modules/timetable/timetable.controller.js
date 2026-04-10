import { ZodError } from 'zod';
import { sendError, sendSuccess } from '../../utils/response.js';
import { createTimetableSchema, getTimetableQuerySchema } from './timetable.schema.js';
import {
  createTimetableEntry,
  getTimetable,
  deleteTimetableEntry,
} from './timetable.service.js';
import { getStudentByUserId } from '../students/students.service.js';

function handleTimetableError(error, request, reply, fallbackMessage) {
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

export async function createTimetableEntryHandler(request, reply) {
  try {
    const payload = createTimetableSchema.parse(request.body);
    const result = await createTimetableEntry(payload);
    return sendSuccess(reply, 201, result, 'Timetable entry created successfully');
  } catch (error) {
    return handleTimetableError(error, request, reply, 'Failed to create timetable entry');
  }
}

export async function getTimetableHandler(request, reply) {
  try {
    const filters = getTimetableQuerySchema.parse(request.query);
    const result = await getTimetable(filters);
    return sendSuccess(reply, 200, result, 'Timetable fetched successfully');
  } catch (error) {
    return handleTimetableError(error, request, reply, 'Failed to fetch timetable');
  }
}

export async function getMyTimetableHandler(request, reply) {
  try {
    let filters = {};
    
    if (request.user.role === 'student') {
      const student = await getStudentByUserId(request.user.id);
      if (!student) return sendError(reply, 404, 'Student profile not found');
      filters.class = student.class;
    } else if (request.user.role === 'teacher') {
      filters.teacherId = request.user.id;
    }

    const result = await getTimetable(filters);
    return sendSuccess(reply, 200, result, 'Your timetable fetched successfully');
  } catch (error) {
    return handleTimetableError(error, request, reply, 'Failed to fetch your timetable');
  }
}

export async function deleteTimetableEntryHandler(request, reply) {
  try {
    const { id } = request.params;
    const result = await deleteTimetableEntry(id);
    return sendSuccess(reply, 200, result, 'Timetable entry deleted successfully');
  } catch (error) {
    return handleTimetableError(error, request, reply, 'Failed to delete timetable entry');
  }
}
