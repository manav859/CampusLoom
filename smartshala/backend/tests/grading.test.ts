import assert from "node:assert/strict";
import { GRADE_BANDS, gradeForPercentage } from "../src/core/grading.js";

assert.deepEqual(
  GRADE_BANDS.map((band) => [band.min, band.grade]),
  [
    [90, "A+"],
    [80, "A"],
    [70, "B+"],
    [60, "B"],
    [50, "C"],
    [40, "D"],
    [0, "F"]
  ]
);

assert.equal(gradeForPercentage(100), "A+");
assert.equal(gradeForPercentage(90), "A+");
assert.equal(gradeForPercentage(89.99), "A");
assert.equal(gradeForPercentage(70), "B+");
assert.equal(gradeForPercentage(50), "C");
assert.equal(gradeForPercentage(40), "D");
assert.equal(gradeForPercentage(39.99), "F");
assert.equal(gradeForPercentage(0), "F");
assert.equal(gradeForPercentage(Number.NaN), "F");

console.log("grading tests passed");
