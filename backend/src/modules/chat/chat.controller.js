import { ZodError } from 'zod';
import { sendError, sendSuccess } from '../../utils/response.js';
import { sendMessageSchema, getChatHistoryParamsSchema } from './chat.schema.js';
import { sendMessage, getChatHistory } from './chat.service.js';
import { getContacts } from './chat.contacts.js';

function handleChatError(error, request, reply, fallbackMessage) {
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

export async function getContactsHandler(request, reply) {
  try {
    const contacts = await getContacts(request.user);
    return sendSuccess(reply, 200, contacts, 'Contacts fetched successfully');
  } catch (error) {
    return handleChatError(error, request, reply, 'Failed to fetch contacts');
  }
}

export async function sendMessageHandler(request, reply) {
  try {
    const payload = sendMessageSchema.parse(request.body);
    const result = await sendMessage(payload, request.user.id);
    return sendSuccess(reply, 201, result, 'Message sent successfully');
  } catch (error) {
    return handleChatError(error, request, reply, 'Failed to send message');
  }
}

export async function getChatHistoryHandler(request, reply) {
  try {
    const { userId } = getChatHistoryParamsSchema.parse(request.params);
    const history = await getChatHistory(request.user.id, userId);
    return sendSuccess(reply, 200, history, 'Chat history fetched successfully');
  } catch (error) {
    return handleChatError(error, request, reply, 'Failed to fetch chat history');
  }
}
