import { ZodError } from 'zod';
import { sendError, sendSuccess } from '../../utils/response.js';
import {
  createTestSchema,
  submitTestResultsSchema,
  getTestsQuerySchema,
} from './tests.schema.js';
import {
  createTest,
  submitResults,
  getTestsByClass,
  getStudentResults,
  getTestWithResults,
} from './tests.service.js';
import { getStudentByUserId } from '../students/students.service.js';

function handleTestsError(error, request, reply, fallbackMessage) {
  if (error instanceof ZodError) {
    return sendError(reply, 400, 'Validation failed', error.issues);
  }
  const statusCode = error.statusCode || 500;
  return sendError(reply, statusCode, statusCode >= 500 ? fallbackMessage : error.message);
}

export async function createTestHandler(request, reply) {
  try {
    const payload = createTestSchema.parse(request.body);
    const result = await createTest(payload, request.user);
    return sendSuccess(reply, 201, result, 'Test created successfully');
  } catch (error) {
    return handleTestsError(error, request, reply, 'Failed to create test');
  }
}

export async function submitResultsHandler(request, reply) {
  try {
    const { testId, results } = submitTestResultsSchema.parse(request.body);
    const result = await submitResults(testId, results);
    return sendSuccess(reply, 200, result, 'Results submitted successfully');
  } catch (error) {
    return handleTestsError(error, request, reply, 'Failed to submit results');
  }
}

export async function getTestsByClassHandler(request, reply) {
  try {
    const { class: className } = getTestsQuerySchema.parse(request.query);
    const result = await getTestsByClass(className);
    return sendSuccess(reply, 200, result, 'Tests fetched successfully');
  } catch (error) {
    return handleTestsError(error, request, reply, 'Failed to fetch tests');
  }
}

export async function getMyResultsHandler(request, reply) {
  try {
    const student = await getStudentByUserId(request.user.id);
    if (!student) return sendError(reply, 404, 'Student profile not found');
    const result = await getStudentResults(student.id);
    return sendSuccess(reply, 200, result, 'Your results fetched successfully');
  } catch (error) {
    return handleTestsError(error, request, reply, 'Failed to fetch results');
  }
}

export async function getTestDetailsHandler(request, reply) {
  try {
    const { id } = request.params;
    const result = await getTestWithResults(id);
    if (!result) return sendError(reply, 404, 'Test not found');
    return sendSuccess(reply, 200, result, 'Test details fetched successfully');
  } catch (error) {
    return handleTestsError(error, request, reply, 'Failed to fetch test details');
  }
}
