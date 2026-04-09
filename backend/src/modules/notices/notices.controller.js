import { ZodError } from 'zod';
import { sendError, sendSuccess } from '../../utils/response.js';
import {
  createNoticeSchema,
  noticeIdParamSchema,
  updateNoticeSchema,
  updateNoticeStatusSchema,
} from './notices.schema.js';
import {
  createNotice,
  deleteNotice,
  getNoticeById,
  listNotices,
  listPublicNotices,
  updateNotice,
  updateNoticeStatus,
} from './notices.service.js';

function handleNoticesError(error, request, reply, fallbackMessage) {
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

export async function listNoticesHandler(request, reply) {
  try {
    const notices = await listNotices();

    return sendSuccess(reply, 200, notices, 'Notices fetched successfully');
  } catch (error) {
    return handleNoticesError(error, request, reply, 'Failed to fetch notices');
  }
}

export async function getNoticeByIdHandler(request, reply) {
  try {
    const { id } = noticeIdParamSchema.parse(request.params);
    const notice = await getNoticeById(id);

    return sendSuccess(reply, 200, notice, 'Notice fetched successfully');
  } catch (error) {
    return handleNoticesError(error, request, reply, 'Failed to fetch notice');
  }
}

export async function createNoticeHandler(request, reply) {
  try {
    const payload = createNoticeSchema.parse(request.body);
    const notice = await createNotice(payload, request.user.id);

    return sendSuccess(reply, 201, notice, 'Notice created successfully');
  } catch (error) {
    return handleNoticesError(error, request, reply, 'Failed to create notice');
  }
}

export async function updateNoticeHandler(request, reply) {
  try {
    const { id } = noticeIdParamSchema.parse(request.params);
    const payload = updateNoticeSchema.parse(request.body);
    const notice = await updateNotice(id, payload);

    return sendSuccess(reply, 200, notice, 'Notice updated successfully');
  } catch (error) {
    return handleNoticesError(error, request, reply, 'Failed to update notice');
  }
}

export async function deleteNoticeHandler(request, reply) {
  try {
    const { id } = noticeIdParamSchema.parse(request.params);
    const deletedNotice = await deleteNotice(id);

    return sendSuccess(reply, 200, deletedNotice, 'Notice deleted successfully');
  } catch (error) {
    return handleNoticesError(error, request, reply, 'Failed to delete notice');
  }
}

export async function updateNoticeStatusHandler(request, reply) {
  try {
    const { id } = noticeIdParamSchema.parse(request.params);
    const { isActive } = updateNoticeStatusSchema.parse(request.body);
    const notice = await updateNoticeStatus(id, isActive);

    return sendSuccess(reply, 200, notice, 'Notice status updated successfully');
  } catch (error) {
    return handleNoticesError(error, request, reply, 'Failed to update notice status');
  }
}

export async function listPublicNoticesHandler(request, reply) {
  try {
    const notices = await listPublicNotices();

    return sendSuccess(reply, 200, notices, 'Public notices fetched successfully');
  } catch (error) {
    return handleNoticesError(error, request, reply, 'Failed to fetch public notices');
  }
}
