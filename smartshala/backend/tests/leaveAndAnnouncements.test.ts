import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import {
  applyForLeave,
  cancelLeave,
  decideLeave,
  listMyLeave,
  listSchoolLeave
} from "../src/modules/leave/leave.service.js";
import {
  createAnnouncement,
  listAnnouncements,
  markAsRead
} from "../src/modules/announcements/announcements.service.js";

/**
 * Integration test for Phase 4 — Leave & Messages. Requires a reachable
 * database (DATABASE_URL). Creates an isolated school with a principal and two
 * teachers, then deletes the school (cascades) at the end.
 */
async function expectAppError(promise: Promise<unknown>, code: string, statusCode: number) {
  try {
    await promise;
    assert.fail(`Expected an AppError with code ${code}, but the call succeeded`);
  } catch (error) {
    assert.ok(error instanceof AppError, `Expected AppError, got ${String(error)}`);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
  }
}

function phone() {
  return `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`;
}

async function main() {
  const school = await prisma.school.create({
    data: { name: "Leave Test School", code: `LV-${randomUUID().slice(0, 8)}` }
  });

  const makeUser = async (fullName: string, role: "PRINCIPAL" | "TEACHER") => {
    const record = await prisma.user.create({
      data: { schoolId: school.id, fullName, phone: phone(), passwordHash: "x", role }
    });
    return {
      id: record.id,
      schoolId: school.id,
      role,
      fullName
    } as Express.UserContext;
  };

  const principal = await makeUser("Leave Test Principal", "PRINCIPAL");
  const teacher = await makeUser("Leave Test Teacher", "TEACHER");
  const otherTeacher = await makeUser("Other Test Teacher", "TEACHER");

  try {
    // ---------------------------------------------------------- leave: apply
    const applied = await applyForLeave(teacher, {
      type: "SICK",
      fromDate: "2026-09-10",
      toDate: "2026-09-12",
      reason: "Down with fever, resting on doctor advice."
    });

    assert.equal(applied.status, "PENDING");
    assert.equal(applied.days, 3, "10th to 12th inclusive is three days");
    assert.equal(applied.applicant.id, teacher.id);
    assert.equal(applied.hasAttachment, false);
    assert.equal(applied.decidedBy, null);

    // ------------------------------------------------- leave: who may decide
    // A teacher may never decide, not even somebody else's request.
    await expectAppError(
      decideLeave(otherTeacher, applied.id, { status: "APPROVED" }),
      "FORBIDDEN",
      403
    );

    // The headline rule for this phase: nobody approves their own request, even
    // a principal, who applies through the very same endpoint.
    const principalLeave = await applyForLeave(principal, {
      type: "CASUAL",
      fromDate: "2026-09-20",
      toDate: "2026-09-20",
      reason: "Family function in the afternoon."
    });
    assert.equal(principalLeave.days, 1, "a single-day leave counts as one day");
    await expectAppError(
      decideLeave(principal, principalLeave.id, { status: "APPROVED" }),
      "CANNOT_DECIDE_OWN_LEAVE",
      403
    );

    // ------------------------------------------------------- leave: decision
    const approved = await decideLeave(principal, applied.id, {
      status: "APPROVED",
      note: "Get well soon."
    });
    assert.equal(approved.status, "APPROVED");
    assert.equal(approved.decidedBy?.id, principal.id);
    assert.equal(approved.decisionNote, "Get well soon.");
    assert.ok(approved.decidedAt instanceof Date);

    // A decided request cannot be decided again.
    await expectAppError(
      decideLeave(principal, applied.id, { status: "REJECTED" }),
      "LEAVE_ALREADY_DECIDED",
      409
    );

    // -------------------------------------------- leave: counts stay honest
    const schoolList = await listSchoolLeave(principal, { limit: 20, offset: 0 });
    assert.equal(schoolList.summary.total, 2, "both requests in the school are counted");
    assert.equal(schoolList.summary.approved, 1);
    assert.equal(schoolList.summary.pending, 1);
    assert.equal(schoolList.summary.rejected, 0);
    assert.equal(
      schoolList.summary.pending + schoolList.summary.approved + schoolList.summary.rejected,
      schoolList.summary.total - schoolList.summary.cancelled,
      "the tiles add up to the total"
    );

    // A teacher's own list is scoped to that teacher, whatever else exists.
    const mine = await listMyLeave(teacher, { limit: 20, offset: 0 });
    assert.equal(mine.total, 1);
    assert.equal(mine.items[0].id, applied.id);
    assert.equal(mine.items[0].status, "APPROVED", "the decision is visible within one refresh");
    assert.equal(mine.summary.total, 1, "the teacher summary excludes the principal request");

    const otherMine = await listMyLeave(otherTeacher, { limit: 20, offset: 0 });
    assert.equal(otherMine.total, 0, "a teacher never sees another teacher's leave");

    // Status filter narrows the list but not the summary tiles.
    const pendingOnly = await listSchoolLeave(principal, {
      status: "PENDING",
      limit: 20,
      offset: 0
    });
    assert.equal(pendingOnly.items.length, 1);
    assert.equal(pendingOnly.items[0].id, principalLeave.id);
    assert.equal(pendingOnly.summary.total, 2, "tiles always describe the whole school");

    // ----------------------------------------------------- leave: withdrawal
    await expectAppError(cancelLeave(teacher, principalLeave.id), "FORBIDDEN", 403);
    const cancelled = await cancelLeave(principal, principalLeave.id);
    assert.equal(cancelled.status, "CANCELLED");

    const afterCancel = await listSchoolLeave(principal, { limit: 20, offset: 0 });
    assert.equal(afterCancel.summary.pending, 0);
    assert.equal(afterCancel.summary.cancelled, 1);
    assert.equal(afterCancel.summary.total, 2);

    // -------------------------------------------------------- announcements
    const staffNotice = await createAnnouncement(principal, {
      title: "Staff meeting on Friday",
      body: "All teaching staff to assemble in the hall at 3pm.",
      audience: "STAFF",
      priority: "IMPORTANT"
    });
    assert.equal(staffNotice.isRead, true, "the author has read their own post");

    const parentsNotice = await createAnnouncement(principal, {
      title: "Fee reminder",
      body: "Term two fees are due by the end of the month.",
      audience: "PARENTS",
      priority: "NORMAL"
    });

    // A teacher may not post.
    await expectAppError(
      createAnnouncement(teacher, {
        title: "Unauthorised notice",
        body: "This should never be stored.",
        audience: "ALL",
        priority: "NORMAL"
      }),
      "FORBIDDEN",
      403
    );

    // The principal's staff announcement reaches the teacher; the parents-only
    // one does not.
    const teacherFeed = await listAnnouncements(teacher, { limit: 20, offset: 0 });
    const teacherIds = teacherFeed.items.map((item) => item.id);
    assert.ok(teacherIds.includes(staffNotice.id), "staff announcement reaches teachers");
    assert.ok(!teacherIds.includes(parentsNotice.id), "parent-only announcement does not");
    assert.equal(teacherFeed.total, 1);
    assert.equal(teacherFeed.unreadCount, 1);
    assert.equal(teacherFeed.items[0].isRead, false);
    assert.equal(teacherFeed.items[0].postedBy?.fullName, "Leave Test Principal");

    // The principal sees both, including the parent notice they published.
    const principalFeed = await listAnnouncements(principal, { limit: 20, offset: 0 });
    assert.equal(principalFeed.total, 2);

    // Read state is per user and idempotent.
    await markAsRead(teacher, staffNotice.id);
    await markAsRead(teacher, staffNotice.id);

    const afterRead = await listAnnouncements(teacher, { limit: 20, offset: 0 });
    assert.equal(afterRead.unreadCount, 0);
    assert.equal(afterRead.items[0].isRead, true);
    assert.equal(
      await prisma.announcementRead.count({ where: { announcementId: staffNotice.id } }),
      1,
      "marking twice stores one row"
    );

    // Reading it as one teacher leaves the other teacher's badge alone.
    const otherFeed = await listAnnouncements(otherTeacher, { limit: 20, offset: 0 });
    assert.equal(otherFeed.unreadCount, 1);

    // A teacher cannot mark a parents-only announcement read — it is not theirs
    // to see at all.
    await expectAppError(markAsRead(teacher, parentsNotice.id), "NOT_FOUND", 404);

    console.log("leaveAndAnnouncements: all assertions passed");
  } finally {
    await prisma.school.delete({ where: { id: school.id } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
