import {
  CommunicationChannel,
  CommunicationMessageType,
  CommunicationStatus,
  CommunicationType,
  NotificationKind,
  NotificationStatus,
  UserRole,
  type CommunicationLog
} from "@prisma/client";
import { prisma, withRetry } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";
import { WhatsAppCloudProvider } from "../notifications/whatsapp.service.js";

type CommunicationUser = Pick<Express.UserContext, "id" | "schoolId" | "role">;

type SendTeacherMessageInput = {
  targetType: "STUDENT" | "CLASS";
  studentId?: string;
  classId?: string;
  type: CommunicationMessageType;
  message: string;
};

type Recipient = {
  id: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: number | null;
  parentPhone: string;
  class: { id: string; name: string; section: string };
};

const provider = new WhatsAppCloudProvider();

function canManageCommunication(user: CommunicationUser) {
  return user.role === UserRole.TEACHER || user.role === UserRole.PRINCIPAL || user.role === UserRole.ADMIN;
}

function classWhereForUser(user: CommunicationUser, classId?: string) {
  return {
    schoolId: user.schoolId,
    ...(classId ? { id: classId } : {}),
    ...(user.role === UserRole.TEACHER ? { classTeacherId: user.id } : {})
  };
}

async function assertClassAccess(user: CommunicationUser, classId: string) {
  if (!canManageCommunication(user)) {
    throw new AppError(403, "You do not have permission to send parent messages", "FORBIDDEN");
  }

  const classRecord = await prisma.class.findFirst({
    where: classWhereForUser(user, classId),
    select: { id: true, name: true, section: true }
  });
  if (!classRecord) throw notFound("Class");
  return classRecord;
}

function notificationKindFor(type: CommunicationMessageType) {
  if (type === CommunicationMessageType.ATTENDANCE_ALERT) return NotificationKind.LOW_ATTENDANCE;
  return NotificationKind.SCHOOL_ALERT;
}

function mapLog(log: CommunicationLog & { student: { id: string; fullName: string; admissionNumber: string; rollNumber: number | null; class: { id: string; name: string; section: string } } }) {
  return {
    id: log.id,
    studentId: log.studentId,
    studentName: log.student.fullName,
    admissionNumber: log.student.admissionNumber,
    rollNumber: log.student.rollNumber,
    classId: log.student.class.id,
    className: `${log.student.class.name}-${log.student.class.section}`,
    message: log.summary,
    type: log.messageType ?? CommunicationMessageType.CUSTOM,
    status: log.status,
    timestamp: log.timestamp
  };
}

export async function communicationContext(user: Express.UserContext) {
  return withRetry(async () => {
    if (!canManageCommunication(user)) {
      throw new AppError(403, "You do not have permission to send parent messages", "FORBIDDEN");
    }

    const classes = await prisma.class.findMany({
      where: classWhereForUser(user),
      include: {
        students: {
          where: { isActive: true },
          select: { id: true, fullName: true, admissionNumber: true, rollNumber: true, parentName: true, parentPhone: true },
          orderBy: [{ rollNumber: "asc" }, { fullName: "asc" }]
        }
      },
      orderBy: [{ name: "asc" }, { section: "asc" }]
    });

    return {
      classes: classes.map((classRecord) => ({
        id: classRecord.id,
        name: classRecord.name,
        section: classRecord.section,
        students: classRecord.students
      }))
    };
  }, { label: "communicationContext" });
}

export async function listTeacherMessages(user: Express.UserContext, query: { classId?: string }) {
  return withRetry(async () => {
    if (!canManageCommunication(user)) {
      throw new AppError(403, "You do not have permission to view parent messages", "FORBIDDEN");
    }
    if (query.classId) await assertClassAccess(user, query.classId);

    const logs = await prisma.communicationLog.findMany({
      where: {
        schoolId: user.schoolId,
        type: CommunicationType.WHATSAPP,
        messageType: { not: null },
        student: {
          ...(query.classId ? { classId: query.classId } : {}),
          ...(user.role === UserRole.TEACHER ? { class: { classTeacherId: user.id } } : {})
        }
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            admissionNumber: true,
            rollNumber: true,
            class: { select: { id: true, name: true, section: true } }
          }
        }
      },
      orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }],
      take: 100
    });

    return logs.map(mapLog);
  }, { label: "listTeacherCommunicationMessages" });
}

async function recipientsForTarget(user: CommunicationUser, input: SendTeacherMessageInput) {
  if (input.targetType === "CLASS") {
    if (!input.classId) throw new AppError(400, "Class is required", "CLASS_REQUIRED");
    await assertClassAccess(user, input.classId);
    const students = await prisma.student.findMany({
      where: { schoolId: user.schoolId, classId: input.classId, isActive: true },
      select: {
        id: true,
        fullName: true,
        admissionNumber: true,
        rollNumber: true,
        parentPhone: true,
        class: { select: { id: true, name: true, section: true } }
      },
      orderBy: [{ rollNumber: "asc" }, { fullName: "asc" }]
    });
    return students;
  }

  if (!input.studentId) throw new AppError(400, "Student is required", "STUDENT_REQUIRED");
  const student = await prisma.student.findFirst({
    where: {
      id: input.studentId,
      schoolId: user.schoolId,
      isActive: true,
      ...(user.role === UserRole.TEACHER ? { class: { classTeacherId: user.id } } : {})
    },
    select: {
      id: true,
      fullName: true,
      admissionNumber: true,
      rollNumber: true,
      parentPhone: true,
      class: { select: { id: true, name: true, section: true } }
    }
  });
  if (!student) throw notFound("Student");
  return [student];
}

async function updateDeliveryStatus(input: { notificationId: string; logId: string; recipientPhone: string; message: string }) {
  try {
    const result = await provider.send({ to: input.recipientPhone, message: input.message });
    await prisma.$transaction([
      prisma.notification.update({
        where: { id: input.notificationId },
        data: { status: NotificationStatus.SENT, sentAt: new Date(), providerMessageId: result.providerMessageId }
      }),
      prisma.communicationLog.update({
        where: { id: input.logId },
        data: { status: CommunicationStatus.SENT, timestamp: new Date() }
      })
    ]);
  } catch (error) {
    await prisma.$transaction([
      prisma.notification.update({
        where: { id: input.notificationId },
        data: { status: NotificationStatus.FAILED, errorMessage: error instanceof Error ? error.message : "Unknown provider error" }
      }),
      prisma.communicationLog.update({
        where: { id: input.logId },
        data: { status: CommunicationStatus.FAILED, timestamp: new Date() }
      })
    ]);
  }
}

export async function sendTeacherMessage(user: Express.UserContext, input: SendTeacherMessageInput) {
  return withRetry(async () => {
    if (!canManageCommunication(user)) {
      throw new AppError(403, "You do not have permission to send parent messages", "FORBIDDEN");
    }

    const recipients = await recipientsForTarget(user, input) as Recipient[];
    if (recipients.length === 0) {
      throw new AppError(400, "No active students found for this message target", "NO_MESSAGE_RECIPIENTS");
    }

    const created = await prisma.$transaction(async (tx) => {
      const rows = [];

      for (const recipient of recipients) {
        const log = await tx.communicationLog.create({
          data: {
            schoolId: user.schoolId,
            studentId: recipient.id,
            type: CommunicationType.WHATSAPP,
            messageType: input.type,
            channel: CommunicationChannel.WHATSAPP,
            summary: input.message,
            status: CommunicationStatus.QUEUED
          },
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                admissionNumber: true,
                rollNumber: true,
                class: { select: { id: true, name: true, section: true } }
              }
            }
          }
        });

        const notification = await tx.notification.create({
          data: {
            schoolId: user.schoolId,
            studentId: recipient.id,
            kind: notificationKindFor(input.type),
            recipientPhone: recipient.parentPhone,
            message: input.message,
            status: NotificationStatus.QUEUED
          }
        });

        rows.push({ log, notificationId: notification.id, recipientPhone: recipient.parentPhone });
      }

      return rows;
    });

    setImmediate(() => {
      void Promise.allSettled(
        created.map((row) =>
          updateDeliveryStatus({
            notificationId: row.notificationId,
            logId: row.log.id,
            recipientPhone: row.recipientPhone,
            message: input.message
          })
        )
      );
    });

    return {
      targetType: input.targetType,
      count: created.length,
      logs: created.map((row) => mapLog(row.log))
    };
  }, { label: "sendTeacherCommunicationMessage" });
}
