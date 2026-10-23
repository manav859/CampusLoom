import assert from "node:assert/strict";
import {
  normalizePhone,
  phoneVariants,
  studentMatchesPhone,
  parentStudentWhere,
} from "../src/utils/parentPhone.js";

/**
 * Parent login matches a login mobile against a student's guardian phones.
 * Schools enter numbers inconsistently, so matching is on the last ten digits.
 * No database is needed.
 */

// normalizePhone keeps the last ten digits, dropping spaces, punctuation and +91.
assert.equal(normalizePhone("9876543210"), "9876543210");
assert.equal(normalizePhone("+91 98765 43210"), "9876543210");
assert.equal(normalizePhone("091-9876543210"), "9876543210");
assert.equal(normalizePhone(""), "");
assert.equal(normalizePhone(null), "");
assert.equal(normalizePhone("12345"), "12345"); // too short, returned as-is

// A match on any guardian field, whatever the stored spelling.
const student = {
  parentPhone: "+91 98765 43210",
  fatherPhone: null,
  motherPhone: "9000000001",
  guardianPhone: null,
  alternatePhone: null,
};
assert.equal(studentMatchesPhone(student, "9876543210"), true, "mother/parent match");
assert.equal(studentMatchesPhone(student, "09000000001"), true, "leading zero match");
assert.equal(studentMatchesPhone(student, "9000000002"), false, "no match");
assert.equal(studentMatchesPhone(student, "98765"), false, "too short never matches");

// The login mobile only has to match the father's field.
const fatherOnly = {
  parentPhone: "9111111111",
  fatherPhone: "919876543210",
  motherPhone: null,
  guardianPhone: null,
  alternatePhone: null,
};
assert.equal(studentMatchesPhone(fatherOnly, "9876543210"), true, "father field match");

// phoneVariants covers the spellings a 10-digit number is stored as.
const variants = phoneVariants("+91-9876543210");
assert.ok(variants.includes("9876543210"));
assert.ok(variants.includes("919876543210"));
assert.ok(variants.includes("+919876543210"));
assert.ok(variants.includes("09876543210"));

// parentStudentWhere builds an OR over every guardian field, matches nothing on a bad number.
const where = parentStudentWhere("9876543210") as { OR: Record<string, unknown>[] };
assert.ok(Array.isArray(where.OR));
assert.equal(where.OR.length, 5, "one clause per guardian field");
const bad = parentStudentWhere("nope") as { parentPhone: string };
assert.equal(bad.parentPhone, "__NO_PARENT_PHONE__", "unusable number matches nothing");

console.log("parentPhone.test.ts: all assertions passed");
