import assert from "node:assert/strict";
import { feeAdjustmentSchema } from "../src/modules/fees/fees.schemas.js";

const studentId = "11111111-1111-4111-8111-111111111111";
const assignmentId = "22222222-2222-4222-8222-222222222222";

const concession = feeAdjustmentSchema.safeParse({
  studentId,
  type: "CONCESSION",
  amount: "500.50",
  reason: "Sibling concession"
});
assert.equal(concession.success, true, "concession should accept student-level target");
if (concession.success) {
  assert.equal(concession.data.amount, 500.5);
  assert.equal(concession.data.reason, "Sibling concession");
}

assert.equal(
  feeAdjustmentSchema.safeParse({
    assignmentId,
    type: "DISCOUNT",
    amount: 100,
    reason: "Festival discount"
  }).success,
  true,
  "discount should accept assignment-level target"
);

assert.equal(
  feeAdjustmentSchema.safeParse({ type: "CONCESSION", amount: 100, reason: "Approved" }).success,
  false,
  "adjustment should require studentId or assignmentId"
);
assert.equal(
  feeAdjustmentSchema.safeParse({ studentId, type: "WAIVER", amount: 100, reason: "Approved" }).success,
  false,
  "adjustment should reject unknown type"
);
assert.equal(
  feeAdjustmentSchema.safeParse({ studentId, type: "DISCOUNT", amount: 0, reason: "Approved" }).success,
  false,
  "adjustment should reject non-positive amounts"
);
assert.equal(
  feeAdjustmentSchema.safeParse({ studentId, type: "DISCOUNT", amount: 100, reason: "No" }).success,
  false,
  "adjustment should require a useful reason"
);

console.log("fee adjustment validation ok");
