import { ZodError } from 'zod';
import { sendError, sendSuccess } from '../../utils/response.js';
import {
  markAttendanceSchema,
  getAttendanceByStudentQuerySchema,
  getAttendanceByClassQuerySchema,
} from './attendance.schema.js';
import {
  markClassAttendance,
  getAttendanceByStudent,
  getAttendanceByClass,
} from './attendance.service.js';
import { getStudentByUserId } from '../students/students.service.js';

function handleAttendanceError(error, request, reply, fallbackMessage) {
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

export async function markClassAttendanceHandler(request, reply) {
  try {
    const payload = markAttendanceSchema.parse(request.body);
    const result = await markClassAttendance(
      { className: payload.class, date: payload.date, records: payload.records },
      request.user
    );

    return sendSuccess(reply, 201, result, 'Attendance marked successfully');
  } catch (error) {
    return handleAttendanceError(error, request, reply, 'Failed to mark attendance');
  }
}

export async function getMyAttendanceHandler(request, reply) {
  try {
    const filters = getAttendanceByStudentQuerySchema.parse(request.query);
    
    // As a student, find my student profile
    const student = await getStudentByUserId(request.user.id);
    if (!student) {
      return sendError(reply, 404, 'Student profile not found');
    }

    const attendance = await getAttendanceByStudent(student.id, filters);
    return sendSuccess(reply, 200, attendance, 'Attendance fetched successfully');
  } catch (error) {
    return handleAttendanceError(error, request, reply, 'Failed to fetch attendance');
  }
}

export async function getClassAttendanceHandler(request, reply) {
  try {
    const filters = getAttendanceByClassQuerySchema.parse(request.query);
    const records = await getAttendanceByClass(filters.class, filters.date);

    return sendSuccess(reply, 200, records, 'Class attendance fetched successfully');
  } catch (error) {
    return handleAttendanceError(error, request, reply, 'Failed to fetch class attendance');
  }
}
