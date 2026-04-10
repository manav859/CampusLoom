import { ZodError } from 'zod';
import { sendError, sendSuccess } from '../../utils/response.js';
import { createLectureSchema, getLecturesQuerySchema } from './lectures.schema.js';
import {
  createLecture,
  listLectures,
  deleteLecture,
} from './lectures.service.js';

function handleLectureError(error, request, reply, fallbackMessage) {
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

export async function createLectureHandler(request, reply) {
  try {
    const payload = createLectureSchema.parse(request.body);
    const result = await createLecture(payload, request.user);
    return sendSuccess(reply, 201, result, 'Lecture created successfully');
  } catch (error) {
    return handleLectureError(error, request, reply, 'Failed to create lecture');
  }
}

export async function listLecturesHandler(request, reply) {
  try {
    const filters = getLecturesQuerySchema.parse(request.query);
    const result = await listLectures(filters);
    return sendSuccess(reply, 200, result, 'Lectures fetched successfully');
  } catch (error) {
    return handleLectureError(error, request, reply, 'Failed to fetch lectures');
  }
}

export async function deleteLectureHandler(request, reply) {
  try {
    const { id } = request.params;
    const result = await deleteLecture(id, request.user);
    return sendSuccess(reply, 200, result, 'Lecture deleted successfully');
  } catch (error) {
    return handleLectureError(error, request, reply, 'Failed to delete lecture');
  }
}
