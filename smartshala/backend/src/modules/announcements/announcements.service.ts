import { AnnouncementAudience, AnnouncementPriority, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

const authorRoles = new Set<UserRole>([UserRole.PRINCIPAL, UserRole.ADMIN]);

/**
 * Which audiences a role is allowed to see. Principal/Admin read everything so
 * they can review what they published; a teacher sees only the buckets that
 * include staff. Parent-only notices never reach the teacher app.
 */
function visibleAudiences(role: UserRole): AnnouncementAudience[] {
  if (authorRoles.has(role)) {
    return [
      AnnouncementAudience.ALL,
      AnnouncementAudience.STAFF,
      AnnouncementAudience.TEACHERS,
      AnnouncementAudience.PARENTS
    ];
  }

  return [AnnouncementAudience.ALL, AnnouncementAudience.STAFF, AnnouncementAudience.TEACHERS];
}

export async function createAnnouncement(
  user: Express.UserContext,
  payload: {
    title: string;
    body: string;
    audience: AnnouncementAudience;
    priority: AnnouncementPriority;
  }
) {
  if (!authorRoles.has(user.role as UserRole)) {
    throw new AppError(403, "Only a Principal or Admin can post announcements.", "FORBIDDEN");
  }

  const created = await prisma.announcement.create({
    data: {
      schoolId: user.schoolId,
      postedById: user.id,
      title: payload.title,
      body: payload.body,
      audience: payload.audience,
      priority: payload.priority
    },
    include: { postedBy: { select: { id: true, fullName: true, role: true } } }
  });

  // The author has, by definition, already read it.
  return {
    id: created.id,
    title: created.title,
    body: created.body,
    audience: created.audience,
    priority: created.priority,
    publishedAt: created.publishedAt,
    isRead: true,
    postedBy: created.postedBy
      ? { id: created.postedBy.id, fullName: created.postedBy.fullName, role: created.postedBy.role }
      : null
  };
}

export async function listAnnouncements(
  user: Express.UserContext,
  query: { limit: number; offset: number }
) {
  const where: Prisma.AnnouncementWhereInput = {
    schoolId: user.schoolId,
    audience: { in: visibleAudiences(user.role as UserRole) }
  };

  // The read marker rides along as a correlated sub-select rather than a second
  // round trip, so a page of announcements is still one database call.
  const [rows, total, unreadCount] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: query.limit,
      skip: query.offset,
      include: {
        postedBy: { select: { id: true, fullName: true, role: true } },
        reads: { where: { userId: user.id }, select: { id: true } }
      }
    }),
    prisma.announcement.count({ where }),
    prisma.announcement.count({ where: { ...where, reads: { none: { userId: user.id } } } })
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      audience: row.audience,
      priority: row.priority,
      publishedAt: row.publishedAt,
      isRead: row.reads.length > 0,
      postedBy: row.postedBy
        ? { id: row.postedBy.id, fullName: row.postedBy.fullName, role: row.postedBy.role }
        : null
    })),
    total,
    unreadCount,
    hasMore: query.offset + rows.length < total
  };
}

export async function markAsRead(user: Express.UserContext, id: string) {
  const announcement = await prisma.announcement.findFirst({
    where: {
      id,
      schoolId: user.schoolId,
      audience: { in: visibleAudiences(user.role as UserRole) }
    },
    select: { id: true }
  });
  if (!announcement) throw notFound("Announcement");

  // Idempotent: opening the same announcement twice must not fail.
  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: announcement.id, userId: user.id } },
    create: { announcementId: announcement.id, userId: user.id },
    update: {}
  });

  return { id: announcement.id, isRead: true };
}
