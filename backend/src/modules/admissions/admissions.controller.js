import { ZodError } from 'zod';
import { sendError, sendSuccess } from '../../utils/response.js';
import {
  admissionIdParamSchema,
  createAdmissionNoteSchema,
  createAdmissionSchema,
  listAdmissionsQuerySchema,
  updateAdmissionStatusSchema,
} from './admissions.schema.js';
import {
  createAdmission,
  createAdmissionNote,
  getAdmissionById,
  listAdmissions,
  listAdmissionsForUser,
  updateAdmissionStatus,
} from './admissions.service.js';

function handleAdmissionsError(error, request, reply, fallbackMessage) {
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

export async function createAdmissionHandler(request, reply) {
  try {
    const payload = createAdmissionSchema.parse(request.body);
    const admission = await createAdmission(payload, request.user);

    return sendSuccess(reply, 201, admission, 'Admission inquiry submitted successfully');
  } catch (error) {
    return handleAdmissionsError(error, request, reply, 'Failed to submit admission inquiry');
  }
}

export async function listAdmissionsHandler(request, reply) {
  try {
    const filters = listAdmissionsQuerySchema.parse(request.query);
    const admissions = await listAdmissions(filters);

    return sendSuccess(reply, 200, admissions, 'Admissions fetched successfully');
  } catch (error) {
    return handleAdmissionsError(error, request, reply, 'Failed to fetch admissions');
  }
}

export async function listCurrentUserAdmissionsHandler(request, reply) {
  try {
    const admissions = await listAdmissionsForUser(request.user);

    return sendSuccess(reply, 200, admissions, 'User admissions fetched successfully');
  } catch (error) {
    return handleAdmissionsError(error, request, reply, 'Failed to fetch user admissions');
  }
}

export async function getAdmissionByIdHandler(request, reply) {
  try {
    const { id } = admissionIdParamSchema.parse(request.params);
    const admission = await getAdmissionById(id);

    return sendSuccess(reply, 200, admission, 'Admission fetched successfully');
  } catch (error) {
    return handleAdmissionsError(error, request, reply, 'Failed to fetch admission');
  }
}

export async function updateAdmissionStatusHandler(request, reply) {
  try {
    const { id } = admissionIdParamSchema.parse(request.params);
    const { status } = updateAdmissionStatusSchema.parse(request.body);
    const updatedAdmission = await updateAdmissionStatus(id, status);

    return sendSuccess(reply, 200, updatedAdmission, 'Admission status updated successfully');
  } catch (error) {
    return handleAdmissionsError(error, request, reply, 'Failed to update admission status');
  }
}

export async function createAdmissionNoteHandler(request, reply) {
  try {
    const { id } = admissionIdParamSchema.parse(request.params);
    const { note } = createAdmissionNoteSchema.parse(request.body);
    const savedNote = await createAdmissionNote(id, note, request.user);

    return sendSuccess(reply, 201, savedNote, 'Admission note added successfully');
  } catch (error) {
    return handleAdmissionsError(error, request, reply, 'Failed to add admission note');
  }
}
