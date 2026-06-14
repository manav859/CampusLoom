/**
 * Reset and re-seed fee data for a single tenant school.
 *
 * What it does (scoped to one school, identified by School.code):
 *   1. Deletes ALL existing fee data — payments, receipts, adjustments,
 *      assignments, installments and fee structures.
 *   2. Creates one BIANNUAL fee structure per class (tiered by grade), each
 *      split into 2 equal half-yearly installments with real due dates.
 *   3. Assigns the structure to every active student in that class.
 *   4. Seeds a realistic spread of mock payments (paid / partial / defaulter)
 *      with receipts, so the ledger's "current due" math is meaningful.
 *
 * Usage (point DATABASE_URL at the SS000001 tenant DB first):
 *   cd backend
 *   DATABASE_URL=postgresql://.../school_SS000001 npx tsx prisma/scripts/reset-school-fees.ts
 *   # optional: SCHOOL_CODE=SS000001 (default), DRY_RUN=1 to preview counts only
 *
 * Idempotent: re-running wipes the fee data it created and rebuilds it.
 */
import { InstallmentStatus, PaymentMode, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const SCHOOL_CODE = process.env.SCHOOL_CODE ?? "SS000001";
const DRY_RUN = process.env.DRY_RUN === "1";
const ACADEMIC_YEAR = "2026-27";

// Half-yearly schedule: installment 1 is already due, installment 2 is upcoming.
const INSTALLMENT_1_DUE = new Date("2026-04-15T00:00:00.000Z");
const INSTALLMENT_2_DUE = new Date("2026-10-15T00:00:00.000Z");

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function num(value: unknown) {
  return Number(value ?? 0);
}

// Deterministic PRNG so re-runs produce the same realistic-looking spread.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x5ab15a);

/** Annual fee tier from a class name, in whole rupees (divisible by 2). */
function annualFeeForClass(className: string) {
  const grade = Number((className.match(/\d+/) ?? [])[0]);
  if (!Number.isFinite(grade)) return 24000; // pre-primary: Nursery / LKG / UKG
  if (grade <= 5) return 30000;
  if (grade <= 8) return 38000;
  if (grade <= 10) return 46000;
  return 54000; // 11-12
}

function randomDateBetween(start: Date, end: Date) {
  const t = start.getTime() + rand() * (end.getTime() - start.getTime());
  const d = new Date(t);
  d.setUTCHours(10, 0, 0, 0);
  return d;
}

/** Payment profile assigned deterministically by student index. */
type Profile = "PAID_FULL" | "PAID_INST1" | "PARTIAL_INST1" | "OVERPAID" | "NONE";
function profileFor(index: number): Profile {
  switch (index % 10) {
    case 0:
    case 1:
    case 2:
    case 3:
      return "PAID_INST1"; // 40% — settled first half
    case 4:
    case 5:
      return "PAID_FULL"; // 20% — paid the whole year early
    case 6:
      return "PARTIAL_INST1"; // 10% — part of first half
    case 7:
      return "OVERPAID"; // 10% — first half + part of second
    default:
      return "NONE"; // 20% (8,9) — defaulters, first half overdue
  }
}

const PAYMENT_MODES: PaymentMode[] = [PaymentMode.CASH, PaymentMode.UPI, PaymentMode.BANK_TRANSFER];

async function main() {
  let school = await prisma.school.findUnique({ where: { code: SCHOOL_CODE } });
  if (!school) {
    // Legacy single-tenant DBs hold one school whose `code` may differ from the
    // schoolId used in-app (e.g. "DEMO-SCHOOL" served as SS000001). Fall back to
    // it only when there is exactly one school — unambiguous and safe.
    const all = await prisma.school.findMany();
    if (all.length === 1) {
      school = all[0];
      console.log(`No school with code "${SCHOOL_CODE}"; using the only school in this DB: ${school.name} (code ${school.code}).`);
    } else {
      throw new Error(`School with code "${SCHOOL_CODE}" not found (and DB has ${all.length} schools — set SCHOOL_CODE).`);
    }
  }
  const schoolId = school.id;

  // The accountant/admin who "recorded" each mock payment.
  const recorder =
    (await prisma.user.findFirst({
      where: { schoolId, role: { in: [UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.PRINCIPAL] }, isActive: true },
      orderBy: { createdAt: "asc" }
    })) ?? (await prisma.user.findFirst({ where: { schoolId } }));
  if (!recorder) {
    throw new Error(`No user found for school ${SCHOOL_CODE} to attribute payments to.`);
  }

  // Ensure the academic year row exists (fee structures link to it).
  const academicYear =
    (await prisma.academicYear.findFirst({ where: { schoolId, name: ACADEMIC_YEAR } })) ??
    (await prisma.academicYear.create({
      data: {
        schoolId,
        name: ACADEMIC_YEAR,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2027-03-31T00:00:00.000Z")
      }
    }));

  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: { students: { where: { isActive: true } } }
  });
  const activeStudentCount = classes.reduce((sum, c) => sum + c.students.length, 0);

  console.log(`School: ${school.name} (${SCHOOL_CODE})`);
  console.log(`Classes: ${classes.length}, active students: ${activeStudentCount}`);

  if (DRY_RUN) {
    console.log("DRY_RUN=1 — no changes written.");
    return;
  }

  // ── 1. Reset all existing fee data for this school ────────────────────────
  await prisma.$transaction([
    prisma.receipt.deleteMany({ where: { schoolId } }),
    prisma.payment.deleteMany({ where: { schoolId } }),
    prisma.feeAdjustment.deleteMany({ where: { schoolId } }),
    prisma.studentFeeAssignment.deleteMany({ where: { schoolId } }),
    prisma.feeStructure.deleteMany({ where: { schoolId } }) // cascades installments
  ]);
  console.log("Cleared existing fee data.");

  let receiptSeq = 0;
  const nextReceiptNo = () => `REC-2026-${String(++receiptSeq).padStart(5, "0")}`;
  let upiSeq = 0;
  let bankSeq = 0;

  let structureCount = 0;
  let assignmentCount = 0;
  let paymentCount = 0;
  let studentIndex = 0;

  for (const klass of classes) {
    if (klass.students.length === 0) continue;

    const annual = annualFeeForClass(klass.name);
    const half = money(annual / 2);
    const structureName = `Annual Fee ${ACADEMIC_YEAR} - ${klass.name}`;

    const structure = await prisma.feeStructure.create({
      data: {
        schoolId,
        classId: klass.id,
        name: structureName,
        academicYear: ACADEMIC_YEAR,
        academicYearId: academicYear.id,
        frequency: "BIANNUAL",
        totalAmount: annual,
        dueDate: INSTALLMENT_1_DUE,
        installments: {
          create: [
            { name: "First Half (Apr-Sep)", dueDate: INSTALLMENT_1_DUE, amount: half, sortOrder: 0 },
            { name: "Second Half (Oct-Mar)", dueDate: INSTALLMENT_2_DUE, amount: half, sortOrder: 1 }
          ]
        }
      },
      include: { installments: { orderBy: { sortOrder: "asc" } } }
    });
    structureCount += 1;
    const [inst1, inst2] = structure.installments;

    for (const student of klass.students) {
      const transport = student.transportRequired ? money(num(student.transportFeeAmount)) : 0;
      const total = money(annual + transport);
      const profile = profileFor(studentIndex++);

      // Mock payments for this student, derived from the profile.
      const payments: { amount: number; installmentId: string; paidAt: Date }[] = [];
      if (profile === "PAID_INST1") {
        payments.push({ amount: half, installmentId: inst1.id, paidAt: randomDateBetween(new Date("2026-04-01"), new Date("2026-05-15")) });
      } else if (profile === "PAID_FULL") {
        payments.push({ amount: half, installmentId: inst1.id, paidAt: randomDateBetween(new Date("2026-04-01"), new Date("2026-04-30")) });
        payments.push({ amount: half, installmentId: inst2.id, paidAt: randomDateBetween(new Date("2026-05-01"), new Date("2026-06-10")) });
      } else if (profile === "PARTIAL_INST1") {
        const part = money(half * (0.4 + rand() * 0.4)); // 40-80% of first half
        payments.push({ amount: part, installmentId: inst1.id, paidAt: randomDateBetween(new Date("2026-04-10"), new Date("2026-06-05")) });
      } else if (profile === "OVERPAID") {
        payments.push({ amount: half, installmentId: inst1.id, paidAt: randomDateBetween(new Date("2026-04-01"), new Date("2026-04-30")) });
        payments.push({ amount: money(half * 0.5), installmentId: inst2.id, paidAt: randomDateBetween(new Date("2026-05-15"), new Date("2026-06-12")) });
      }
      // profile === "NONE": no payments (defaulter)

      const paidAmount = money(payments.reduce((s, p) => s + p.amount, 0));
      const pendingAmount = money(total - paidAmount);
      const status =
        pendingAmount <= 0 ? InstallmentStatus.PAID : paidAmount > 0 ? InstallmentStatus.PARTIAL : InstallmentStatus.PENDING;

      const assignment = await prisma.studentFeeAssignment.create({
        data: {
          schoolId,
          studentId: student.id,
          feeStructureId: structure.id,
          totalAmount: total,
          transportFeeAmount: transport,
          paidAmount,
          pendingAmount,
          status
        }
      });
      assignmentCount += 1;

      for (const p of payments) {
        const mode = PAYMENT_MODES[paymentCount % PAYMENT_MODES.length];
        const payment = await prisma.payment.create({
          data: {
            schoolId,
            studentId: student.id,
            assignmentId: assignment.id,
            installmentId: p.installmentId,
            recordedById: recorder.id,
            amount: p.amount,
            mode,
            upiTransactionId: mode === PaymentMode.UPI ? `UPI${SCHOOL_CODE}${String(++upiSeq).padStart(6, "0")}` : undefined,
            bankReference: mode === PaymentMode.BANK_TRANSFER ? `NEFT${String(++bankSeq).padStart(6, "0")}` : undefined,
            paidAt: p.paidAt
          }
        });
        await prisma.receipt.create({
          data: { schoolId, paymentId: payment.id, receiptNo: nextReceiptNo(), issuedAt: p.paidAt }
        });
        paymentCount += 1;
      }
    }
  }

  console.log(
    `Done. Structures: ${structureCount}, assignments: ${assignmentCount}, payments: ${paymentCount}, receipts: ${receiptSeq}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
