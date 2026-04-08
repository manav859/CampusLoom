import { registerSchema, loginSchema } from './auth.schema.js';
import * as authService from './auth.service.js';

export async function registerHandler(request, reply) {
  try {
    // Validate request body
    const data = registerSchema.parse(request.body);

    const user = await authService.registerUser(data);

    reply.code(201).send({
      message: 'User registered successfully',
      data: user,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return reply.badRequest(error.errors.map(e => e.message).join(', '));
    }
    if (error.message === 'Email is already in use') {
      return reply.badRequest(error.message);
    }
    request.log.error(error);
    reply.internalServerError('Failed to register user');
  }
}

export async function loginHandler(request, reply) {
  try {
    const data = loginSchema.parse(request.body);

    const result = await authService.loginUser(data);

    reply.send({
      message: 'Logged in successfully',
      data: result,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return reply.badRequest(error.errors.map(e => e.message).join(', '));
    }
    if (error.message === 'Invalid credentials' || error.message === 'User account is deactivated') {
      return reply.unauthorized(error.message);
    }
    request.log.error(error);
    reply.internalServerError('Failed to login');
  }
}

export async function meHandler(request, reply) {
  // `request.user` is populated by the `authenticate` middleware
  reply.send({
    data: {
      user: request.user,
    },
  });
}
