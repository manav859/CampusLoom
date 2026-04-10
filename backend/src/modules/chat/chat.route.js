import { authenticate } from '../../middleware/auth.js';
import {
  sendMessageHandler,
  getChatHistoryHandler,
} from './chat.controller.js';

export default async function chatRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/contacts', getContactsHandler);
  fastify.post('/', sendMessageHandler);
  fastify.get('/:userId', getChatHistoryHandler);
}
