import { ZodError } from 'zod';
import { sendError, sendSuccess } from '../../utils/response.js';
import { createNotificationSchema } from './notifications.schema.js';
import {
  createNotification,
  getNotificationsForUser,
  markAsRead,
} from './notifications.service.js';

function handleNotificationsError(error, request, reply, fallbackMessage) {
  if (error instanceof ZodError) {
    return sendError(reply, 400, 'Validation failed', error.issues);
  }
  const statusCode = error.statusCode || 500;
  return sendError(reply, statusCode, statusCode >= 500 ? fallbackMessage : error.message);
}

export async function createNotificationHandler(request, reply) {
  try {
    const payload = createNotificationSchema.parse(request.body);
    const result = await createNotification(payload);
    return sendSuccess(reply, 201, result, 'Notification created successfully');
  } catch (error) {
    return handleNotificationsError(error, request, reply, 'Failed to create notification');
  }
}

export async function getMyNotificationsHandler(request, reply) {
  try {
    const result = await getNotificationsForUser(request.user.id);
    return sendSuccess(reply, 200, result, 'Notifications fetched successfully');
  } catch (error) {
    return handleNotificationsError(error, request, reply, 'Failed to fetch notifications');
  }
}

export async function markAsReadHandler(request, reply) {
  try {
    const { id } = request.params;
    const result = await markAsRead(id);
    return sendSuccess(reply, 200, result, 'Notification marked as read');
  } catch (error) {
    return handleNotificationsError(error, request, reply, 'Failed to mark notification as read');
  }
}
