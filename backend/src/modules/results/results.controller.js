import { ZodError } from 'zod';
import { sendError, sendSuccess } from '../../utils/response.js';
import {
  createResultSchema,
  studentIdParamSchema,
} from './results.schema.js';
import {
  createResult,
  getResultsByStudentId,
  getResultsForUser,
} from './results.service.js';

function handleResultsError(error, request, reply, fallbackMessage) {
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

export async function createResultHandler(request, reply) {
  try {
    const payload = createResultSchema.parse(request.body);
    const result = await createResult(payload);

    return sendSuccess(reply, 201, result, 'Result created successfully');
  } catch (error) {
    return handleResultsError(error, request, reply, 'Failed to create result');
  }
}

export async function getStudentResultsHandler(request, reply) {
  try {
    const { studentId } = studentIdParamSchema.parse(request.params);
    const results = await getResultsByStudentId(studentId);

    return sendSuccess(reply, 200, results, 'Student results fetched successfully');
  } catch (error) {
    return handleResultsError(error, request, reply, 'Failed to fetch student results');
  }
}

export async function getCurrentUserResultsHandler(request, reply) {
  try {
    const results = await getResultsForUser(request.user.id);

    return sendSuccess(reply, 200, results, 'Your results fetched successfully');
  } catch (error) {
    return handleResultsError(error, request, reply, 'Failed to fetch your results');
  }
}
