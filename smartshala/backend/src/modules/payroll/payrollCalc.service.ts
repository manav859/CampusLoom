import { LeaveStatus, LeaveType, Prisma, SalarySlipStatus, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";
import { toStatus } from "../staffAttendance/staffAttendance.service.js";

/**
 * Pay from attendance. Each staff member has a monthly salary and, usually, a
 * shift. A working day (Monday to Saturday, not a school holiday) earns a full
 * day when the punched time reaches FULL_DAY_SHARE of the shift and half a day
 * below that; approved leave is paid except UNPAID leave; a day with no punch
 * and no leave is absent. Pay is the monthly salary less one day's rate —
 * salary ÷ working days in the month — for every day not earned.
 */
export const FULL_DAY_SHARE = 0.75;

const managerRoles = new Set<UserRole>([UserRole.PRINCIPAL, UserRole.ADMIN]);
const payableRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER, UserRole.ACCOUNTANT];

function assertManager(user: Express.UserContext) {
  if (!managerRoles.has(user.role as UserRole)) {
    throw new AppError(403, "Only a Principal or Admin can manage payroll.", "FORBIDDEN");
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** A shift that ends before it starts runs past midnight. */
export function shiftMinutes(shift: { startTime: string; endTime: string }) {
  const length = toMinutes(shift.endTime) - toMinutes(shift.startTime);
  return length > 0 ? length : length + 24 * 60;
}

/** YYYY-MM-DD in server-local time — how punch and holiday dates are stored. */
function localDayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toShift(shift: { id: string; name: string; startTime: string; endTime: string }) {
  return { id: shift.id, name: shift.name, startTime: shift.startTime, endTime: shift.endTime, minutes: shiftMinutes(shift) };
}

// --- Shifts ---------------------------------------------------------------------

export async function listShifts(user: Express.UserContext) {
  assertManager(user);
  const shifts = await prisma.staffShift.findMany({
    where: { schoolId: user.schoolId },
    orderBy: [{ startTime: "asc" }, { name: "asc" }],
    include: { _count: { select: { payProfiles: true } } }
  });
  return shifts.map((shift) => ({ ...toShift(shift), staffCount: shift._count.payProfiles }));
}

type ShiftInput = { name: string; startTime: string; endTime: string };

export async function saveShift(user: Express.UserContext, id: string | null, input: ShiftInput) {
  assertManager(user);
  if (input.startTime === input.endTime) {
    throw new AppError(400, "A shift needs different start and end times.", "EMPTY_SHIFT");
  }
  try {
    if (!id) {
      return toShift(await prisma.staffShift.create({ data: { ...input, schoolId: user.schoolId } }));
    }
    const { count } = await prisma.staffShift.updateMany({ where: { id, schoolId: user.schoolId }, data: input });
    if (count === 0) throw notFound("Shift");
    return toShift(await prisma.staffShift.findUniqueOrThrow({ where: { id } }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "A shift with this name already exists.", "SHIFT_NAME_TAKEN");
    }
    throw error;
  }
}

/** Staff on a deleted shift keep their salary and are paid on any punch until given another. */
export async function deleteShift(user: Express.UserContext, id: string) {
  assertManager(user);
  const { count } = await prisma.staffShift.deleteMany({ where: { id, schoolId: user.schoolId } });
  if (count === 0) throw notFound("Shift");
}

// --- Pay profiles -------------------------------------------------------------------

export async function savePayProfile(
  user: Express.UserContext,
  userId: string,
  input: { monthlySalary: number; shiftId?: string | null }
) {
  assertManager(user);
  const member = await prisma.user.findFirst({
    where: { id: userId, schoolId: user.schoolId, role: { in: payableRoles } },
    select: { id: true }
  });
  if (!member) throw notFound("Staff member");

  const shiftId = input.shiftId ?? null;
  if (shiftId && !(await prisma.staffShift.findFirst({ where: { id: shiftId, schoolId: user.schoolId }, select: { id: true } }))) {
    throw notFound("Shift");
  }

  const data = { monthlySalary: input.monthlySalary, shiftId };
  const saved = await prisma.staffPayProfile.upsert({
    where: { userId },
    create: { ...data, userId, schoolId: user.schoolId },
    update: data,
    include: { shift: true }
  });
  return { userId, monthlySalary: Number(saved.monthlySalary), shift: saved.shift ? toShift(saved.shift) : null };
}

// --- Calculation ----------------------------------------------------------------------

/**
 * One row per active staff member for the month: how each working day counts,
 * and the pay that follows. Days still ahead in the current month are not
 * deducted, and today counts in full once punched — it is not over.
 */
export async function calculateMonth(user: Express.UserContext, month: string, now = new Date()) {
  assertManager(user);
  const schoolId = user.schoolId;
  const [year, monthIndex] = month.split("-").map(Number);
  const from = new Date(year, monthIndex - 1, 1);
  const to = new Date(year, monthIndex, 1);

  const [staff, punches, holidays, leaves, slips] = await Promise.all([
    prisma.user.findMany({
      where: { schoolId, isActive: true, role: { in: payableRoles } },
      select: { id: true, fullName: true, role: true, phone: true, createdAt: true, payProfile: { include: { shift: true } } },
      orderBy: [{ role: "asc" }, { fullName: "asc" }]
    }),
    prisma.staffAttendance.findMany({
      where: { schoolId, date: { gte: from, lt: to } },
      include: { sessions: { orderBy: { startAt: "asc" } } }
    }),
    prisma.holiday.findMany({ where: { schoolId, date: { gte: from, lt: to } }, select: { date: true } }),
    // Leave days are stored at midnight UTC, so the overlap uses UTC month bounds.
    prisma.leaveRequest.findMany({
      where: {
        schoolId,
        status: LeaveStatus.APPROVED,
        fromDate: { lt: new Date(Date.UTC(year, monthIndex, 1)) },
        toDate: { gte: new Date(Date.UTC(year, monthIndex - 1, 1)) }
      },
      select: { userId: true, type: true, fromDate: true, toDate: true }
    }),
    prisma.salarySlip.findMany({ where: { schoolId, month } })
  ]);

  const holidayKeys = new Set(holidays.map((row) => localDayKey(row.date)));
  const punchByDay = new Map(punches.map((row) => [`${row.userId}|${localDayKey(row.date)}`, row]));
  const leaveByDay = new Map<string, LeaveType>();
  for (const leave of leaves) {
    for (const day = new Date(leave.fromDate); day <= leave.toDate; day.setUTCDate(day.getUTCDate() + 1)) {
      leaveByDay.set(`${leave.userId}|${day.toISOString().slice(0, 10)}`, leave.type);
    }
  }
  const slipByUser = new Map(slips.map((slip) => [slip.userId, slip]));

  const workingDays: Date[] = [];
  for (const day = new Date(from); day < to; day.setDate(day.getDate() + 1)) {
    if (day.getDay() !== 0 && !holidayKeys.has(localDayKey(day))) workingDays.push(new Date(day));
  }
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const items = staff.map((member) => {
    const profile = member.payProfile;
    const shift = profile?.shift ?? null;
    const fullDayMinutes = shift ? shiftMinutes(shift) * FULL_DAY_SHARE : 0;
    const joined = new Date(member.createdAt);
    joined.setHours(0, 0, 0, 0);

    const days = { full: 0, half: 0, leave: 0, unpaidLeave: 0, absent: 0, beforeJoining: 0, upcoming: 0, missingPunchOut: 0 };
    for (const day of workingDays) {
      const key = localDayKey(day);
      if (day < joined) {
        days.beforeJoining++;
        continue;
      }
      if (day > today) {
        days.upcoming++;
        continue;
      }

      const punch = punchByDay.get(`${member.id}|${key}`);
      if (punch) {
        const status = toStatus(punch, now);
        const isToday = day.getTime() === today.getTime();
        if (!isToday && status.state !== "PUNCHED_OUT") {
          // Forgot to punch out: the hours are unknown, so the day is not cut.
          days.missingPunchOut++;
          days.full++;
        } else if (isToday || !shift || status.workedMinutes >= fullDayMinutes) {
          days.full++;
        } else {
          days.half++;
        }
        continue;
      }

      // Leave rows are UTC dates; match them on the working day's local calendar date.
      const leaveType = leaveByDay.get(`${member.id}|${key}`);
      if (leaveType) {
        if (leaveType === LeaveType.UNPAID) days.unpaidLeave++;
        else days.leave++;
      } else if (day.getTime() === today.getTime()) {
        days.upcoming++;
      } else {
        days.absent++;
      }
    }

    const monthlySalary = profile ? Number(profile.monthlySalary) : null;
    const deductionDays = days.absent + days.unpaidLeave + days.beforeJoining + days.half * 0.5;
    const dayRate = monthlySalary !== null && workingDays.length ? monthlySalary / workingDays.length : 0;
    const calculatedPay = monthlySalary === null ? null : round2(Math.max(0, monthlySalary - dayRate * deductionDays));
    const slip = slipByUser.get(member.id);

    return {
      user: { id: member.id, fullName: member.fullName, role: member.role, phone: member.phone },
      shift: shift ? toShift(shift) : null,
      monthlySalary,
      dayRate: round2(dayRate),
      days,
      deductionDays,
      calculatedPay,
      slip: slip ? { id: slip.id, status: slip.status, netPay: Number(slip.netPay) } : null,
      // Nobody records their own salary.
      canEdit: member.id !== user.id
    };
  });

  return {
    month,
    workingDays: workingDays.length,
    fullDayShare: FULL_DAY_SHARE,
    items,
    summary: {
      staff: items.length,
      withSalary: items.filter((item) => item.monthlySalary !== null).length,
      totalCalculated: round2(items.reduce((sum, item) => sum + (item.calculatedPay ?? 0), 0))
    }
  };
}

/**
 * Writes the calculated pay into this month's slips: basic pay is the monthly
 * salary and the attendance cut is the deduction, so the teacher's Pay Slip
 * shows both. Allowances already on a slip are kept; paid slips are not touched.
 */
export async function generateSlips(user: Express.UserContext, month: string) {
  const calculation = await calculateMonth(user, month);
  const existing = new Map(
    (await prisma.salarySlip.findMany({ where: { schoolId: user.schoolId, month } })).map((slip) => [slip.userId, slip])
  );

  let generated = 0;
  let skippedPaid = 0;
  let skippedNoSalary = 0;
  for (const item of calculation.items) {
    if (!item.canEdit) continue;
    if (item.monthlySalary === null || item.calculatedPay === null) {
      skippedNoSalary++;
      continue;
    }
    const slip = existing.get(item.user.id);
    if (slip?.status === SalarySlipStatus.PAID) {
      skippedPaid++;
      continue;
    }

    const allowances = slip ? Number(slip.allowances) : 0;
    const deductions = round2(item.monthlySalary - item.calculatedPay);
    const { days } = item;
    const parts = [
      `${days.full} full`,
      days.half ? `${days.half} half` : null,
      days.leave ? `${days.leave} paid leave` : null,
      days.unpaidLeave ? `${days.unpaidLeave} unpaid leave` : null,
      days.absent ? `${days.absent} absent` : null
    ].filter(Boolean);
    const data = {
      basicPay: item.monthlySalary,
      allowances,
      deductions,
      netPay: round2(item.monthlySalary + allowances - deductions),
      status: SalarySlipStatus.PENDING,
      paidOn: null,
      note: `From attendance: ${parts.join(", ")} of ${calculation.workingDays} working days`,
      recordedById: user.id
    };
    await prisma.salarySlip.upsert({
      where: { userId_month: { userId: item.user.id, month } },
      create: { ...data, schoolId: user.schoolId, userId: item.user.id, month },
      update: data
    });
    generated++;
  }

  return { generated, skippedPaid, skippedNoSalary, calculation: await calculateMonth(user, month) };
}
