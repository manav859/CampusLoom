import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

type AuditInput = {
  action: string;
  actorId?: string | null;
  after?: unknown;
  before?: unknown;
  entityId: string;
  entityType: string;
  schoolId: string;
  summary: string;
};

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function recordAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorId: input.actorId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      beforeJson: toJson(input.before),
      afterJson: toJson(input.after)
    }
  });
}
