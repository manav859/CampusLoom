import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { notifyFeeDefaulter } from "../src/modules/fees/fees.service.js";

/**
 * "Notify in App" on the defaulter queue logs a fee-reminder message (so it
 * shows in the parent app feed) and refuses a student with no dues. The push
 * itself is fire-and-forget and asserted elsewhere. Requires DATABASE_URL.
 */
async function main() {
  const school = await prisma.school.create({
    data: { name: "Fee Notify School", code: `FN-${randomUUID().slice(0, 8)}` }
  });
  const schoolId = school.id;
  const phone = () => `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`;

  try {
    const classRecord = await prisma.class.create({
      data: { schoolId, name: "6", section: "A", academicYear: "2026-27" }
    });
    const owing = await prisma.student.create({
      data: {
        schoolId, classId: classRecord.id, fullName: "Owing Child",
        admissionNumber: `ADM-${randomUUID().slice(0, 6)}`, parentName: "P", parentPhone: phone()
      }
    });
    const paid = await prisma.student.create({
      data: {
        schoolId, classId: classRecord.id, fullName: "Paid Child",
        admissionNumber: `ADM-${randomUUID().slice(0, 6)}`, parentName: "P", parentPhone: phone()
      }
    });

    const structure = await prisma.feeStructure.create({
      data: { schoolId, classId: classRecord.id, name: "Tuition", totalAmount: 10000, frequency: "ANNUAL", academicYear: "2026-27" }
    });
    await prisma.studentFeeAssignment.create({
      data: { schoolId, studentId: owing.id, feeStructureId: structure.id, totalAmount: 10000, paidAmount: 2500, pendingAmount: 7500 }
    });
    await prisma.studentFeeAssignment.create({
      data: { schoolId, studentId: paid.id, feeStructureId: structure.id, totalAmount: 10000, paidAmount: 10000, pendingAmount: 0 }
    });

    // 1. A defaulter: a FEE_REMINDER communication log is written with the
    //    pending total, which is what the parent app feed reads.
    const result = await notifyFeeDefaulter(schoolId, owing.id);
    assert.equal(result.amount, 7500, "the reminder carries the pending total");

    const logs = await prisma.communicationLog.findMany({
      where: { schoolId, studentId: owing.id, messageType: "FEE_REMINDER" }
    });
    assert.equal(logs.length, 1, "exactly one fee-reminder message is logged");
    assert.match(logs[0].summary, /7,500/, "the message names the amount");
    assert.equal(logs[0].type, "WHATSAPP", "logged as a parent-feed message");

    // 2. A student with nothing pending is refused, and nothing is logged.
    await assert.rejects(
      () => notifyFeeDefaulter(schoolId, paid.id),
      /no pending fees/i,
      "a fully-paid student cannot be nudged"
    );
    const paidLogs = await prisma.communicationLog.count({
      where: { schoolId, studentId: paid.id }
    });
    assert.equal(paidLogs, 0, "no message is logged for a paid student");

    console.log("feeDefaulterNotify: all assertions passed");
  } finally {
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
