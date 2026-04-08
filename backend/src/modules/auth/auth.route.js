import { registerHandler, loginHandler, meHandler } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';

export default async function authRoutes(fastify) {
  fastify.post('/register', registerHandler);
  fastify.post('/login', loginHandler);
  
  fastify.get('/me', {
    preHandler: authenticate,
  }, meHandler);
}
