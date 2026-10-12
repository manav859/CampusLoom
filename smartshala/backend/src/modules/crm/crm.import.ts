import { AppError } from "../../core/errors.js";
import { csvLeadRowSchema } from "./crm.schemas.js";
import { createLead, type LeadInput } from "./crm.service.js";
import type { CrmActor } from "./crm.shared.js";

/**
 * Bulk import: a CSV of leads, one deal per row. Every row goes through the
 * same checks as "Create deal", so a row that clashes with an open deal or
 * with a school that already exists is reported and skipped rather than
 * silently merged — the rest of the file still imports.
 */

/** Enough for a list bought or exported from somewhere, without a request that runs for minutes. */
const MAX_ROWS = 500;

type Column = { key: keyof LeadInput; label: string; required?: boolean; aliases: string[] };

/** Headers are matched ignoring case, spaces and punctuation: "School Name" = "school_name". */
const COLUMNS: Column[] = [
  { key: "schoolName", label: "School Name", required: true, aliases: ["schoolname", "school", "institution", "institute", "academy"] },
  { key: "ownerName", label: "Principal Name", required: true, aliases: ["ownername", "owner", "principal", "principalname", "contactname", "contactperson", "name"] },
  { key: "email", label: "Email", required: true, aliases: ["email", "emailaddress", "mail", "emailid"] },
  { key: "phone", label: "Phone", required: true, aliases: ["phone", "phonenumber", "mobile", "mobilenumber", "contactnumber", "contact", "whatsapp"] },
  { key: "address", label: "Address", aliases: ["address", "city", "location"] },
  { key: "gstin", label: "GSTIN", aliases: ["gstin", "gst", "gstno", "gstnumber"] },
  { key: "stateName", label: "State", aliases: ["state", "statename"] },
  { key: "stateCode", label: "State Code", aliases: ["statecode", "gststatecode"] },
  { key: "numberOfStudents", label: "Students", aliases: ["numberofstudents", "students", "studentcount", "totalstudents"] },
  { key: "numberOfStaff", label: "Staff", aliases: ["numberofstaff", "staff", "staffcount", "teachers", "totalstaff"] }
];

/** The header row the UI tells people to use, and what a failed match is measured against. */
export const CSV_TEMPLATE_HEADERS = ["School Name", "Principal Name", "Email", "Phone", "Address", "GSTIN", "State", "Students", "Staff"];

function headerKey(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * RFC 4180: a quoted field may hold commas, line breaks and "" for a literal
 * quote. Excel writes a byte order mark, which would otherwise glue itself to
 * the first header.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const body = text.replace(/^﻿/, "");

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];

    if (quoted) {
      if (char !== '"') field += char;
      else if (body[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = false;
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }

  row.push(field);
  rows.push(row);
  // A trailing newline, or a row of empty cells Excel left behind, is not a lead.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** Which column holds which lead field; unknown columns are ignored. */
function mapHeaders(headers: string[]) {
  const mapped = new Map<number, keyof LeadInput>();

  headers.forEach((header, index) => {
    const key = headerKey(header);
    const column = COLUMNS.find((candidate) => candidate.aliases.includes(key));
    if (column && ![...mapped.values()].includes(column.key)) mapped.set(index, column.key);
  });

  const missing = COLUMNS.filter((column) => column.required && ![...mapped.values()].includes(column.key));
  if (missing.length) {
    throw new AppError(
      400,
      `The CSV needs a column for ${missing.map((column) => column.label).join(" and ")}. Expected headers: ${CSV_TEMPLATE_HEADERS.join(", ")}`,
      "CSV_COLUMNS_MISSING"
    );
  }

  return mapped;
}

export type ImportFailure = { line: number; schoolName: string; error: string };
export type ImportResult = { created: number; failed: ImportFailure[] };

export async function importLeadsFromCsv(actor: CrmActor, input: { csv: string; assignedToId?: string | null }): Promise<ImportResult> {
  const rows = parseCsv(input.csv);
  if (rows.length < 2) throw new AppError(400, "The CSV has a header row but no leads", "CSV_EMPTY");

  const [headers, ...body] = rows;
  const mapped = mapHeaders(headers);
  if (body.length > MAX_ROWS) {
    throw new AppError(400, `A file can hold at most ${MAX_ROWS} leads — this one has ${body.length}. Split it and import again.`, "CSV_TOO_LARGE");
  }

  const result: ImportResult = { created: 0, failed: [] };

  for (const [index, cells] of body.entries()) {
    // Line 1 is the header, so the first lead sits on line 2 — what a spreadsheet shows.
    const line = index + 2;
    const raw: Record<string, string> = {};
    for (const [column, key] of mapped) {
      const cell = (cells[column] ?? "").trim();
      // A spreadsheet writes a count as "1,200"; everything else keeps its commas.
      raw[key] = key === "numberOfStudents" || key === "numberOfStaff" ? cell.replace(/[,\s]/g, "") : cell;
    }

    const parsed = csvLeadRowSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      result.failed.push({ line, schoolName: raw.schoolName ?? "", error: `${issue.path.join(".") || "row"}: ${issue.message}` });
      continue;
    }

    try {
      await createLead(actor, { ...parsed.data, assignedToId: input.assignedToId ?? null });
      result.created += 1;
    } catch (err) {
      result.failed.push({
        line,
        schoolName: parsed.data.schoolName,
        error: err instanceof AppError ? err.message : "Could not import this row"
      });
    }
  }

  return result;
}
