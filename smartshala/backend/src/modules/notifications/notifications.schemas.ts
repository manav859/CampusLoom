import { NotificationKind } from "@prisma/client";
import { z } from "zod";

export const queueNotificationSchema = z.object({
  studentId: z.string().uuid().optional(),
  kind: z.nativeEnum(NotificationKind),
  recipientPhone: z.string().min(10),
  message: z.string().min(3)
});

