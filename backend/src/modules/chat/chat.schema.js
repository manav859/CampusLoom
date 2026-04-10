import { z } from 'zod';

export const sendMessageSchema = z.object({
  receiverId: z.string().min(1, 'Receiver ID is required'),
  message: z.string().min(1, 'Message cannot be empty'),
});

export const getChatHistoryParamsSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});
