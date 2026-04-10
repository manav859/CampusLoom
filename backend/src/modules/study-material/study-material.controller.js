import { ZodError } from 'zod';
import { sendError, sendSuccess } from '../../utils/response.js';
import { getStudyMaterialQuerySchema } from './study-material.schema.js';
import {
  uploadStudyMaterial,
  listStudyMaterials,
  deleteStudyMaterial,
} from './study-material.service.js';

function handleStudyMaterialError(error, request, reply, fallbackMessage) {
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

export async function uploadStudyMaterialHandler(request, reply) {
  try {
    if (!request.isMultipart()) {
      return sendError(reply, 400, 'Request must be multipart/form-data');
    }

    const result = await uploadStudyMaterial(request, request.user);
    return sendSuccess(reply, 201, result, 'Study material uploaded successfully');
  } catch (error) {
    return handleStudyMaterialError(error, request, reply, 'Failed to upload study material');
  }
}

export async function listStudyMaterialsHandler(request, reply) {
  try {
    const filters = getStudyMaterialQuerySchema.parse(request.query);
    const result = await listStudyMaterials(filters);
    return sendSuccess(reply, 200, result, 'Study materials fetched successfully');
  } catch (error) {
    return handleStudyMaterialError(error, request, reply, 'Failed to fetch study materials');
  }
}

export async function deleteStudyMaterialHandler(request, reply) {
  try {
    const { id } = request.params;
    const result = await deleteStudyMaterial(id, request.user);
    return sendSuccess(reply, 200, result, 'Study material deleted successfully');
  } catch (error) {
    return handleStudyMaterialError(error, request, reply, 'Failed to delete study material');
  }
}
