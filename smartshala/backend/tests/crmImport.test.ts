import assert from "node:assert/strict";
import { parseCsv } from "../src/modules/crm/crm.import.js";
import { leadFromMeta } from "../src/modules/crm/crm.meta.js";

/**
 * The two pure pieces of lead intake: reading a CSV a spreadsheet wrote, and
 * turning a Meta form's answers into a deal. Neither needs a database.
 */

// --- CSV ---------------------------------------------------------------------

{
  const rows = parseCsv("School Name,Email\nNoble Public School,head@noble.test\n");
  assert.deepEqual(rows, [
    ["School Name", "Email"],
    ["Noble Public School", "head@noble.test"]
  ]);
}

{
  // Excel: a byte order mark, CRLF line endings and a trailing blank line.
  const rows = parseCsv('﻿School Name,Phone\r\nNoble Public School,9876543210\r\n\r\n');
  assert.deepEqual(rows[0], ["School Name", "Phone"]);
  assert.equal(rows.length, 2, "the blank line is not a lead");
}

{
  // A quoted field keeps its commas, its line break and its doubled quotes.
  const rows = parseCsv('School Name,Address\n"St. Mary""s, Jaipur","12 Main Road\nJaipur"');
  assert.deepEqual(rows[1], ['St. Mary"s, Jaipur', "12 Main Road\nJaipur"]);
}

// --- Meta answers ------------------------------------------------------------

{
  const lead = leadFromMeta([
    { name: "full_name", values: ["Asha Verma"] },
    { name: "email", values: ["asha@noble.test"] },
    { name: "phone_number", values: ["+91 98765 43210"] },
    { name: "school_name", values: ["Noble Public School"] },
    { name: "how_many_students", values: ["1,250"] }
  ]);
  assert.equal(lead.ownerName, "Asha Verma");
  assert.equal(lead.phone, "9876543210", "the country code is dropped");
  assert.equal(lead.schoolName, "Noble Public School");
  assert.equal(lead.numberOfStudents, 1250);
}

{
  // Meta's Lead Ads Testing Tool: every answer is "<test lead: dummy data for …>".
  const lead = leadFromMeta([
    { name: "full_name", values: ["<test lead: dummy data for full_name>"] },
    { name: "email", values: ["test@meta.com"] },
    { name: "phone_number", values: ["<test lead: dummy data for phone_number>"] }
  ]);
  assert.equal(lead.ownerName, "Test Lead");
  assert.equal(lead.schoolName, "Test School");
  assert.equal(lead.email, "test@meta.com", "a real answer is left alone");
  assert.equal(lead.phone, "", "the dummy phone is dropped rather than stored");
}

{
  const lead = leadFromMeta([
    { name: "full_name", values: ["<test lead: dummy data for full_name>"] },
    { name: "school_name", values: ["<test lead: dummy data for school_name>"] }
  ]);
  assert.equal(lead.schoolName, "Test School");
}

console.log("crm import and meta answers: ok");
