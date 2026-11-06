import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AppError } from "../src/core/errors.js";
import { masterPrisma } from "../src/master-db/masterPrisma.js";
import { createCheckoutSession, getBillingOverview, mockGatewayPay } from "../src/modules/billing/billing.service.js";
import { assertStudentCapacity, createUpgradeCheckout } from "../src/modules/billing/billing.upgrade.js";
import { bootstrapSubscription, createPlan, grantAccess } from "../src/modules/billing/billingAdmin.service.js";

/**
 * Moving up a student tier mid-term: the school pays the difference between the
 * two plans, its renewal date does not move, and admitting past the tier is
 * refused with that quote attached.
 *
 *   MASTER_DATABASE_URL=... DATABASE_URL=... RAZORPAY_MODE=mock npm run test:plan-upgrade
 *
 * The plans are created by the test, so it does not depend on which price list
 * the target database happens to be seeded with.
 */

const ACTOR = { kind: "PRINCIPAL" as const, label: "test" };
const TENANT_DB_URL = process.env.DATABASE_URL;

async function expectAppError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof AppError, `Expected AppError, got ${String(error)}`);
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`Expected AppError ${code}, but the call succeeded`);
}

async function main() {
  const stamp = Date.now().toString().slice(-6);
  const schoolId = `U${randomUUID().replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 7)}`;
  const smallCode = `UPSMALL${stamp}`;
  const bigCode = `UPBIG${stamp}`;
  const topCode = `UPTOP${stamp}`;

  await masterPrisma.school.create({
    data: {
      schoolId,
      schoolName: "Upgrade Test School",
      ownerName: "Test Principal",
      email: `upgrade-${schoolId.toLowerCase()}@example.test`,
      phone: "9000000000",
      address: "Test address",
      numberOfStudents: 300,
      numberOfStaff: 10,
      planType: "TRIAL",
      isTrial: true,
      isActive: false,
      dbName: `school_${schoolId}`,
      dbUrl: TENANT_DB_URL ?? "postgresql://unused/unused"
    }
  });

  // Which tier an upgrade lands on depends on the whole catalogue, so the test
  // takes every other plan off sale for the duration and puts it back after.
  const shelved = await masterPrisma.plan.findMany({ where: { isPublic: true }, select: { id: true } });
  await masterPrisma.plan.updateMany({
    where: { id: { in: shelved.map((row) => row.id) } },
    data: { isPublic: false }
  });

  try {
    // The three tiers under test, at the published prices.
    await createPlan({ code: smallCode, name: "Starter", priceRupees: 9_999, interval: "YEAR", maxStudents: 300, sortOrder: 810 });
    await createPlan({ code: bigCode, name: "Growth", priceRupees: 14_999, interval: "YEAR", maxStudents: 700, sortOrder: 820 });
    await createPlan({
      code: topCode,
      name: "Enterprise",
      priceRupees: 39_999,
      interval: "YEAR",
      maxStudents: null,
      features: { customPricing: true },
      sortOrder: 830
    });

    await bootstrapSubscription({ schoolId, planCode: "TRIAL" });
    await grantAccess(schoolId);

    // --- buy the small tier --------------------------------------------------
    const first = await createCheckoutSession({ schoolId, planCode: smallCode, actor: ACTOR });
    assert.equal(first.invoice.subtotalMinor, 999_900, "Starter is 9,999 a year");
    await mockGatewayPay({ orderId: first.orderId, outcome: "success", method: "upi" });

    let subscription = await masterPrisma.subscription.findUniqueOrThrow({ where: { schoolId } });
    const renewalDate = subscription.currentPeriodEnd;
    assert.equal(subscription.status, "ACTIVE", "the small tier is paid for");

    // --- the tier is full ----------------------------------------------------
    const full = await getBillingOverview(schoolId, { students: 300, staff: 4 });
    assert.equal(full.usage.studentsRemaining, 0, "300 of 300 leaves no room");
    assert.equal(full.upgrade?.planCode, bigCode, "the next tier that fits is offered");
    assert.equal(full.upgrade?.subtotalMinor, 500_000, "14,999 less 9,999 is 5,000");
    assert.equal(full.upgrade?.totalMinor, 590_000, "plus 18% GST");
    assert.equal(full.upgrade?.chargesDifferenceOnly, true);
    assert.equal(
      full.upgrade?.periodEnd.toISOString(),
      renewalDate.toISOString(),
      "the quote is for the term already paid for"
    );

    // Still 300-capped, so a school well under the cap is quoted the same move.
    const roomy = await getBillingOverview(schoolId, { students: 120, staff: 4 });
    assert.equal(roomy.usage.studentsRemaining, 180);
    assert.equal(roomy.upgrade?.planCode, bigCode, "the next tier is always quotable");

    // --- the upgrade invoice -------------------------------------------------
    const upgrade = await createUpgradeCheckout({ schoolId, planCode: bigCode, actor: ACTOR });
    assert.equal(upgrade.amountMinor, 590_000, "only the difference is charged");
    assert.equal(upgrade.invoice.subtotalMinor, 500_000);
    assert.equal(
      new Date(upgrade.invoice.periodEnd).toISOString(),
      renewalDate.toISOString(),
      "the invoice buys the rest of this term, not a second one"
    );

    const twice = await createUpgradeCheckout({ schoolId, planCode: bigCode, actor: ACTOR });
    assert.equal(twice.invoice.id, upgrade.invoice.id, "a double click reuses the open upgrade invoice");

    // A quoted tier cannot be bought online, and neither can a sideways move.
    await expectAppError(createUpgradeCheckout({ schoolId, planCode: topCode, actor: ACTOR }), "PLAN_NOT_SELF_SERVE");
    await expectAppError(createUpgradeCheckout({ schoolId, planCode: smallCode, actor: ACTOR }), "PLAN_NOT_AN_UPGRADE");

    // Nor can it be bought over the top of an open renewal invoice, which would
    // drop the school back to the old tier the moment that renewal is paid.
    const renewal = await masterPrisma.invoice.create({
      data: {
        number: `INV-TEST-${stamp}`,
        schoolId,
        planCode: smallCode,
        planName: "Starter",
        status: "DUE",
        subtotalMinor: 999_900,
        totalMinor: 1_179_882,
        periodStart: renewalDate,
        periodEnd: new Date(renewalDate.getTime() + 365 * 24 * 60 * 60 * 1000),
        dueAt: renewalDate
      }
    });
    await expectAppError(createUpgradeCheckout({ schoolId, planCode: bigCode, actor: ACTOR }), "RENEWAL_INVOICE_OPEN");
    await masterPrisma.invoice.delete({ where: { id: renewal.id } });

    // --- paying it swaps the plan and keeps the date -------------------------
    await mockGatewayPay({ orderId: upgrade.orderId, outcome: "success", method: "upi" });
    const upgraded = await masterPrisma.subscription.findUniqueOrThrow({
      where: { schoolId },
      include: { plan: true }
    });
    assert.equal(upgraded.plan.code, bigCode, "the school is on the bigger tier");
    assert.equal(
      upgraded.currentPeriodEnd.toISOString(),
      renewalDate.toISOString(),
      "paying the difference did not move the renewal date"
    );

    const after = await getBillingOverview(schoolId, { students: 300, staff: 4 });
    assert.equal(after.usage.maxStudents, 700, "the new cap is in force");
    assert.equal(after.usage.studentsRemaining, 400);
    assert.equal(after.upgrade?.planCode, topCode, "the next step up is now the quoted tier");
    assert.equal(after.upgrade?.selfServe, false, "which is not bought online");

    // --- admitting past the cap ---------------------------------------------
    if (TENANT_DB_URL) {
      const { prisma } = await import("../src/core/prisma.js");
      const tenantSchool = await prisma.school.create({
        data: { name: "Upgrade Test Tenant", code: `UT-${randomUUID().slice(0, 8)}` }
      });
      const user = {
        id: randomUUID(),
        schoolId: tenantSchool.id,
        tenantSchoolId: schoolId,
        role: "PRINCIPAL" as const,
        fullName: "Test Principal"
      };

      // An empty tenant is 0 of 700, so an admission goes through untouched.
      await assertStudentCapacity(user);

      const klass = await prisma.class.create({
        data: { schoolId: tenantSchool.id, name: "1", section: "A", academicYear: "2026-27" }
      });
      await prisma.student.createMany({
        data: Array.from({ length: 700 }, (_row, index) => ({
          schoolId: tenantSchool.id,
          classId: klass.id,
          fullName: `Student ${index}`,
          admissionNumber: `U-${stamp}-${index}`,
          parentName: "Parent",
          parentPhone: "9000000001"
        }))
      });

      const refused = await expectAppError(assertStudentCapacity(user), "PLAN_STUDENT_LIMIT_REACHED");
      assert.equal(refused.statusCode, 409);
      const details = refused.details as {
        students: number;
        maxStudents: number;
        upgrade: { planCode: string; selfServe: boolean } | null;
      };
      assert.equal(details.students, 700);
      assert.equal(details.maxStudents, 700);
      assert.equal(details.upgrade?.planCode, topCode, "the refusal names the tier that would fit");
      assert.equal(details.upgrade?.selfServe, false, "and says to contact us, since it is quoted");
      assert.ok(refused.message.includes("700"), "the message states the cap");

      // An inactive student does not count against the cap.
      const [oldest] = await prisma.student.findMany({ where: { schoolId: tenantSchool.id }, take: 1 });
      await prisma.student.update({ where: { id: oldest.id }, data: { isActive: false } });
      await assertStudentCapacity(user);

      await prisma.student.deleteMany({ where: { schoolId: tenantSchool.id } });
      await prisma.class.deleteMany({ where: { schoolId: tenantSchool.id } });
      await prisma.school.delete({ where: { id: tenantSchool.id } });
      console.log("- admission limit enforced against the tenant database");
    } else {
      console.log("- skipped the admission check (no DATABASE_URL)");
    }

    console.log("- tier upgrade bills the difference and keeps the renewal date");
  } finally {
    await masterPrisma.school.delete({ where: { schoolId } }).catch(() => undefined);
    await masterPrisma.plan.deleteMany({ where: { code: { in: [smallCode, bigCode, topCode] } } }).catch(() => undefined);
    await masterPrisma.plan
      .updateMany({ where: { id: { in: shelved.map((row) => row.id) } }, data: { isPublic: true } })
      .catch(() => undefined);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await masterPrisma.$disconnect();
  });
