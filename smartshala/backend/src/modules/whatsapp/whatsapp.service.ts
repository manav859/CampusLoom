import { NotificationKind, NotificationStatus } from "@prisma/client";
import { prisma } from "../../core/prisma.js";

export type WhatsAppMessage = {
  phone: string;
  message: string;
};

type SendMessageOptions = {
  schoolId?: string;
  studentId?: string;
  kind?: NotificationKind;
};

type SendBulkOptions = {
  schoolId?: string;
  studentId?: string;
  kind?: NotificationKind;
};

function normalizePhone(phone: string) {
  return phone.trim();
}

async function logNotification(phone: string, message: string, options: SendMessageOptions) {
  if (!options.schoolId) return null;

  return prisma.notification.create({
    data: {
      schoolId: options.schoolId,
      studentId: options.studentId,
      kind: options.kind ?? NotificationKind.SCHOOL_ALERT,
      recipientPhone: phone,
      message,
      status: NotificationStatus.SENT,
      sentAt: new Date(),
      providerMessageId: "mock-whatsapp"
    }
  });
}

export async function sendMessage(phone: string, message: string, options: SendMessageOptions = {}) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return { success: false, skipped: true as const };
  }

  console.log("[WA SENT]", normalizedPhone, message);
  await logNotification(normalizedPhone, message, options);

  return { success: true };
}

export async function sendBulk(messages: WhatsAppMessage[], options: SendBulkOptions = {}) {
  const seen = new Set<string>();
  let sentCount = 0;

  for (const entry of messages) {
    const normalizedPhone = normalizePhone(entry.phone);
    const dedupeKey = `${normalizedPhone}::${entry.message}`;

    if (!normalizedPhone || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    const result = await sendMessage(normalizedPhone, entry.message, options);
    if (result.success) {
      sentCount += 1;
    }
  }

  return { success: true, count: sentCount };
}

export async function getLogs(schoolId: string) {
  return prisma.notification.findMany({
    where: { schoolId },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          admissionNumber: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}
