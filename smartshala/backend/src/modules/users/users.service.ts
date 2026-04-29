import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { getPagination } from "../../core/pagination.js";
import { notFound } from "../../core/errors.js";

export async function listUsers(schoolId: string, query: unknown, role?: UserRole) {
  const pagination = getPagination(query);
  const where = {
    schoolId,
    ...(role ? { role } : {}),
    ...(pagination.search
      ? {
          OR: [
            { fullName: { contains: pagination.search, mode: "insensitive" as const } },
            { phone: { contains: pagination.search } },
            { email: { contains: pagination.search, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...((query as any).showInactive === "true" || (query as any).showInactive === true ? { isActive: false } : { isActive: true })
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true, phone: true, role: true, status: true, createdAt: true }
    }),
    prisma.user.count({ where })
  ]);

  return { items, total, page: pagination.page, limit: pagination.limit };
}

export async function createUser(schoolId: string, data: { fullName: string; email?: string; phone: string; password: string; role: UserRole }) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  return prisma.user.create({
    data: { schoolId, fullName: data.fullName, email: data.email, phone: data.phone, passwordHash, role: data.role },
    select: { id: true, fullName: true, email: true, phone: true, role: true, status: true }
  });
}

export async function updateUser(schoolId: string, id: string, data: Record<string, unknown>) {
  const exists = await prisma.user.findFirst({ where: { id, schoolId } });
  if (!exists) throw notFound("User");
  return prisma.user.update({
    where: { id },
    data,
    select: { id: true, fullName: true, email: true, phone: true, role: true, status: true }
  });
}

export async function deleteUser(schoolId: string, id: string) {
  const exists = await prisma.user.findFirst({ where: { id, schoolId } });
  if (!exists) throw notFound("User");
  return prisma.user.update({
    where: { id },
    data: { status: "INACTIVE", isActive: false }
  });
}

export async function activateUser(schoolId: string, id: string) {
  const exists = await prisma.user.findFirst({ where: { id, schoolId } });
  if (!exists) throw notFound("User");
  return prisma.user.update({
    where: { id },
    data: { status: "ACTIVE", isActive: true }
  });
}

