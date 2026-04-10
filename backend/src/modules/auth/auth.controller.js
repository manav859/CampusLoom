import { registerSchema, loginSchema } from './auth.schema.js';
import * as authService from './auth.service.js';
import { sendError, sendSuccess } from '../../utils/response.js';

export async function registerHandler(request, reply) {
  try {
    const data = registerSchema.parse(request.body);
    const user = await authService.registerUser(data);

    return sendSuccess(reply, 201, user, 'User registered successfully');
  } catch (error) {
    if (error.name === 'ZodError') {
      return sendError(reply, 400, 'Validation failed', error.issues);
    }

    if (error.statusCode) {
      return sendError(reply, error.statusCode, error.message);
    }

    request.log.error(error);

    return sendError(reply, 500, 'Failed to register user');
  }
}

export async function loginHandler(request, reply) {
  try {
    const data = loginSchema.parse(request.body);
    const result = await authService.loginUser(data);

    return sendSuccess(reply, 200, result, 'Logged in successfully');
  } catch (error) {
    if (error.name === 'ZodError') {
      return sendError(reply, 400, 'Validation failed', error.issues);
    }

    if (error.statusCode) {
      return sendError(reply, error.statusCode, error.message);
    }

    request.log.error(error);

    return sendError(reply, 500, 'Failed to login');
  }
}

export async function meHandler(request, reply) {
  return sendSuccess(
    reply,
    200,
    {
      user: request.user,
    },
    'Current user fetched successfully',
  );
}
