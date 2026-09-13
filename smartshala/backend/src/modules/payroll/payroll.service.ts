import { SalarySlip, SalarySlipStatus, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

const managerRoles = new Set<UserRole>([UserRole.PRINCIPAL, UserRole.ADMIN]);
const payableRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER, UserRole.ACCOUNTANT];

type SlipInput = {
  userId: string;
  month: string;
  basicPay: number;
  allowances: number;
  deductions: number;
  status: SalarySlipStatus;
  paidOn?: string | null;
  note?: string | null;
};

/** Money leaves the API as plain numbers so no client has to parse Decimal strings. */
function toSlip(row: SalarySlip) {
  return {
    id: row.id,
    userId: row.userId,
    month: row.month,
    basicPay: Number(row.basicPay),
    allowances: Number(row.allowances),
    deductions: Number(row.deductions),
    netPay: Number(row.netPay),
    status: row.status,
    paidOn: row.paidOn ? row.paidOn.toISOString().slice(0, 10) : null,
    note: row.note,
    updatedAt: row.updatedAt
  };
}

function assertManager(user: Express.UserContext) {
  if (!managerRoles.has(user.role as UserRole)) {
    throw new AppError(403, "Only a Principal or Admin can manage payroll.", "FORBIDDEN");
  }
}

/** The signed-in user's own slips, newest month first, with this year's paid total. */
export async function listMySlips(user: Express.UserContext) {
  const rows = await prisma.salarySlip.findMany({
    where: { schoolId: user.schoolId, userId: user.id },
    orderBy: { month: "desc" }
  });
  const slips = rows.map(toSlip);
  const year = new Date().getFullYear();
  const paidThisYear = slips
    .filter((slip) => slip.status === SalarySlipStatus.PAID && slip.month.startsWith(`${year}-`))
    .reduce((sum, slip) => sum + slip.netPay, 0);

  return { items: slips, summary: { latest: slips[0] ?? null, paidThisYear, year } };
}

/** One row per active staff member for the month, with their slip or null. */
export async function listMonth(user: Express.UserContext, month: string) {
  assertManager(user);

  const [staff, slips] = await Promise.all([
    prisma.user.findMany({
      where: { schoolId: user.schoolId, isActive: true, role: { in: payableRoles } },
      select: { id: true, fullName: true, role: true, phone: true },
      orderBy: [{ role: "asc" }, { fullName: "asc" }]
    }),
    prisma.salarySlip.findMany({ where: { schoolId: user.schoolId, month } })
  ]);

  const slipByUser = new Map(slips.map((slip) => [slip.userId, toSlip(slip)]));
  const items = staff.map((member) => ({
    user: member,
    // Nobody records their own salary, so the list says so up front.
    canEdit: member.id !== user.id,
    slip: slipByUser.get(member.id) ?? null
  }));

  const recorded = items.flatMap((item) => (item.slip ? [item.slip] : []));
  const summary = {
    staff: items.length,
    recorded: recorded.length,
    paid: recorded.filter((slip) => slip.status === SalarySlipStatus.PAID).length,
    pending: recorded.filter((slip) => slip.status === SalarySlipStatus.PENDING).length,
    totalNetPay: recorded.reduce((sum, slip) => sum + slip.netPay, 0)
  };

  return { month, items, summary };
}

/** Creates or replaces the slip for one staff member and month. */
export async function saveSlip(user: Express.UserContext, input: SlipInput) {
  assertManager(user);

  if (input.userId === user.id) {
    throw new AppError(403, "You cannot record your own salary.", "CANNOT_RECORD_OWN_SALARY");
  }

  const member = await prisma.user.findFirst({
    where: { id: input.userId, schoolId: user.schoolId, role: { in: payableRoles } },
    select: { id: true }
  });
  if (!member) throw notFound("Staff member");

  const netPay = Math.round((input.basicPay + input.allowances - input.deductions) * 100) / 100;
  if (netPay < 0) {
    throw new AppError(400, "Deductions cannot be more than basic pay plus allowances.", "NEGATIVE_NET_PAY");
  }

  const paidOn =
    input.status === SalarySlipStatus.PAID
      ? new Date(`${input.paidOn ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
      : null;

  const data = {
    basicPay: input.basicPay,
    allowances: input.allowances,
    deductions: input.deductions,
    netPay,
    status: input.status,
    paidOn,
    note: input.note || null,
    recordedById: user.id
  };

  const saved = await prisma.salarySlip.upsert({
    where: { userId_month: { userId: member.id, month: input.month } },
    create: { ...data, schoolId: user.schoolId, userId: member.id, month: input.month },
    update: data
  });

  return toSlip(saved);
}

export async function deleteSlip(user: Express.UserContext, id: string) {
  assertManager(user);

  const { count } = await prisma.salarySlip.deleteMany({
    where: { id, schoolId: user.schoolId, userId: { not: user.id } }
  });
  if (count === 0) throw notFound("Salary slip");
}
