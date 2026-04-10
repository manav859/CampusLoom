import { Notification } from './notification.model.js';

export async function createNotification(payload) {
  const notification = await Notification.create(payload);
  return notification;
}

export async function getNotificationsForUser(userId) {
  const notifications = await Notification.find({
    $or: [{ userId: null }, { userId }],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
    
  return notifications.map(n => ({
    id: n._id.toString(),
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt,
  }));
}

export async function markAsRead(notificationId) {
  await Notification.findByIdAndUpdate(notificationId, { isRead: true });
  return { success: true };
}
