import assert from "node:assert/strict";
import { createExamWithMarksSchema, examTermSchema } from "../src/modules/marks/marks.schemas.js";

const basePayload = {
  classId: "11111111-1111-4111-8111-111111111111",
  subjectId: "22222222-2222-4222-8222-222222222222",
  name: "Unit Test 1",
  maxMarks: 100,
  date: "2026-05-16",
  results: [
    {
      studentId: "33333333-3333-4333-8333-333333333333",
      marks: 76
    }
  ]
};

const terms = ["UNIT_TEST", "MID_TERM", "FINAL", "TERM_1", "TERM_2"] as const;

for (const term of terms) {
  assert.equal(examTermSchema.safeParse(term).success, true, `${term} should be valid`);
  assert.equal(createExamWithMarksSchema.safeParse({ ...basePayload, term }).success, true, `${term} should be accepted on exam create`);
}

assert.equal(examTermSchema.safeParse("PRE_BOARD").success, false, "unknown exam term should be rejected");
assert.equal(createExamWithMarksSchema.safeParse(basePayload).success, false, "exam create should require term");

console.log("marks exam term validation ok");
