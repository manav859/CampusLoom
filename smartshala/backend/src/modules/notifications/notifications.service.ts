import { NotificationStatus } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { WhatsAppCloudProvider } from "./whatsapp.service.js";

const provider = new WhatsAppCloudProvider();

export async function listNotifications(schoolId: string) {
  return prisma.notification.findMany({
    where: { schoolId },
    include: {
      student: { select: { id: true, fullName: true, admissionNumber: true } },
      sentBy: { select: { id: true, fullName: true, role: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function queueNotification(
  schoolId: string,
  sentById: string,
  data: { studentId?: string; kind: "ABSENCE" | "LOW_ATTENDANCE" | "FEE_REMINDER" | "OVERDUE_FEE" | "PAYMENT_RECEIPT" | "MONTHLY_REPORT" | "SCHOOL_ALERT"; recipientPhone: string; message: string }
) {
  const notification = await prisma.notification.create({
    data: { schoolId, sentById, ...data, status: NotificationStatus.QUEUED }
  });

  setImmediate(async () => {
    try {
      const result = await provider.send({ to: data.recipientPhone, message: data.message });
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date(), providerMessageId: result.providerMessageId }
      });
    } catch (error) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED, errorMessage: error instanceof Error ? error.message : "Unknown provider error" }
      });
    }
  });

  return notification;
}
