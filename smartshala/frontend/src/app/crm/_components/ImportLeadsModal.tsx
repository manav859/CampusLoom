"use client";

import { useState } from "react";
import { Field, FormModal, Select } from "../../super-admin/_components/ui";
import { useAction } from "../../super-admin/_lib/action";
import { crmFetch } from "../crmFetch";
import { invalidate, useResource } from "../_lib/resource";
import { useCrmUser } from "../_lib/session";
import type { TeamMember } from "../_lib/types";

type ImportResult = { created: number; failed: Array<{ line: number; schoolName: string; error: string }> };

const HEADERS = "School Name, Principal Name, Email, Phone, Address, GSTIN, State, Students, Staff";

/**
 * Bulk import from a CSV. The file is read in the browser and sent as text —
 * the server makes each row a deal, and reports the rows it could not take
 * rather than refusing the whole file.
 */
export function ImportLeadsModal({ onClose }: { onClose: () => void }) {
  const user = useCrmUser();
  const isAdmin = user.role === "ADMIN";
  const team = useResource<TeamMember[]>(isAdmin ? "/team" : null);
  const { run, isPending } = useAction();
  const [file, setFile] = useState<File | null>(null);
  const [assignedToId, setAssignedToId] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const ownerOptions = [
    { value: "", label: "Unassigned" },
    ...(team.data ?? []).filter((member) => member.isActive).map((member) => ({ value: member.id, label: member.name }))
  ];

  async function submit() {
    if (result) {
      onClose();
      return;
    }
    if (!file) return;

    const csv = await file.text();
    const done = await run(
      "lead-import",
      async () => {
        const report = await crmFetch<ImportResult>("/leads/import", {
          method: "POST",
          body: JSON.stringify({ csv, ...(isAdmin ? { assignedToId } : {}) })
        });
        invalidate("/leads");
        return report;
      },
      (report) => `${report.created} deal${report.created === 1 ? "" : "s"} imported.`
    );
    if (done === undefined) return;
    setResult(done);
  }

  return (
    <FormModal
      description={result ? undefined : "One deal per row. Rows that clash with an open deal are skipped and listed."}
      onClose={onClose}
      onSubmit={submit}
      open
      submitDisabled={!result && !file}
      submitLabel={result ? "Done" : "Import deals"}
      submitting={isPending("lead-import")}
      title={result ? "Import finished" : "Import deals from CSV"}
    >
      {result ? (
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-slate-800">
            {result.created} deal{result.created === 1 ? "" : "s"} created
            {result.failed.length ? `, ${result.failed.length} row${result.failed.length === 1 ? "" : "s"} skipped` : ""}.
          </p>
          {result.failed.length ? (
            <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2.5">
              {result.failed.map((row) => (
                <li className="text-xs text-slate-700" key={row.line}>
                  <span className="font-semibold">Line {row.line}</span>
                  {row.schoolName ? ` · ${row.schoolName}` : ""} — {row.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <Field hint={`Columns: ${HEADERS}. The first four are needed, the rest are optional.`} label="CSV file">
            <input
              accept=".csv,text/csv"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </Field>
          {isAdmin ? (
            <Field hint="Every deal in the file goes to this person." label="Assign to">
              <Select ariaLabel="Assign imported deals to" onChange={setAssignedToId} options={ownerOptions} value={assignedToId} />
            </Field>
          ) : null}
        </div>
      )}
    </FormModal>
  );
}
