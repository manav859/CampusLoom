import { Message } from './message.model.js';

export async function sendMessage(payload, senderId) {
  const message = await Message.create({
    senderId,
    receiverId: payload.receiverId,
    message: payload.message,
  });

  return {
    id: message._id.toString(),
    senderId: message.senderId.toString(),
    receiverId: message.receiverId.toString(),
    message: message.message,
    createdAt: message.createdAt,
  };
}

export async function getChatHistory(userA, userB) {
  const messages = await Message.find({
    $or: [
      { senderId: userA, receiverId: userB },
      { senderId: userB, receiverId: userA },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();

  return messages.map((m) => ({
    id: m._id.toString(),
    senderId: m.senderId.toString(),
    receiverId: m.receiverId.toString(),
    message: m.message,
    createdAt: m.createdAt,
  }));
}
