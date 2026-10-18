import assert from "node:assert/strict";
import { sortClassRecords } from "../src/utils/sortClasses.js";

/**
 * Class names are strings, so `orderBy: { name: "asc" }` puts 10-B before 2-A.
 * Every endpoint that hands the apps or the web a class list runs its rows
 * through sortClassRecords instead. No database is needed.
 */

const label = (rows: { name: string; section: string }[]) => rows.map((row) => `${row.name}-${row.section}`);
const classes = (...names: string[]) =>
  names.map((name) => {
    const [className, section] = name.split("-");
    return { name: className, section };
  });

// The reported bug: a teacher's homework class list read 10-B, 1-A, 2-A.
assert.deepEqual(
  label(sortClassRecords(classes("10-B", "1-A", "2-A"))),
  ["1-A", "2-A", "10-B"]
);

// Double digits sort by value, not by first character.
assert.deepEqual(
  label(sortClassRecords(classes("12-A", "9-A", "11-A", "10-A"))),
  ["9-A", "10-A", "11-A", "12-A"]
);

// Same class, different sections: the section decides.
assert.deepEqual(
  label(sortClassRecords(classes("5-C", "5-A", "5-B"))),
  ["5-A", "5-B", "5-C"]
);

// Named classes have no number, so they fall back to alphabetical and sit
// after the numbered ones.
assert.deepEqual(
  label(sortClassRecords(classes("Nursery-A", "1-A", "LKG-A"))),
  ["1-A", "LKG-A", "Nursery-A"]
);

// The input array is left alone — callers map over the returned copy.
const original = classes("10-A", "2-A");
sortClassRecords(original);
assert.deepEqual(label(original), ["10-A", "2-A"]);

console.log("class order tests passed");
