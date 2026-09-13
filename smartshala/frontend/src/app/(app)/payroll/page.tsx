"use client";

import { useCallback, useEffect, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton } from "@/components/ui/Skeleton";
import { payrollApi, type PayrollMonth, type SalarySlipStatus } from "@/lib/api";
import { formatINR, humanizeConstant } from "@/lib/formatters";

type Row = PayrollMonth["items"][number];

type Draft = {
  basicPay: string;
  allowances: string;
  deductions: string;
  status: SalarySlipStatus;
  paidOn: string;
  note: string;
};

const fieldClass = "min-h-11 w-full rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[14px] font-medium text-[#031526] outline-none transition focus:border-[#2456E6] focus:ring-2 focus:ring-[#2456E6]/10";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [year, index] = month.split("-").map(Number);
  return monthKey(new Date(year, index - 1 + delta, 1));
}

function monthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function rupees(value: number) {
  return formatINR(value, { compact: false, maximumFractionDigits: 2 });
}

function draftFor(row: Row): Draft {
  const slip = row.slip;
  return {
    basicPay: slip ? String(slip.basicPay) : "",
    allowances: slip ? String(slip.allowances) : "0",
    deductions: slip ? String(slip.deductions) : "0",
    status: slip?.status ?? "PAID",
    paidOn: slip?.paidOn ?? todayValue(),
    note: slip?.note ?? ""
  };
}

export default function PayrollPage() {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [data, setData] = useState<PayrollMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError("");
    try {
      setData(await payrollApi.month(target));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payroll");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [load, month]);

  function openEditor(row: Row) {
    setEditing(row);
    setDraft(draftFor(row));
    setFormError("");
  }

  function closeEditor() {
    setEditing(null);
    setDraft(null);
  }

  const basic = Number(draft?.basicPay || 0);
  const allowances = Number(draft?.allowances || 0);
  const deductions = Number(draft?.deductions || 0);
  const netPay = Math.round((basic + allowances - deductions) * 100) / 100;

  async function save() {
    if (!editing || !draft) return;
    if (!draft.basicPay || basic <= 0) {
      setFormError("Enter the basic pay.");
      return;
    }
    if (netPay < 0) {
      setFormError("Deductions cannot be more than basic pay plus allowances.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      await payrollApi.save({
        userId: editing.user.id,
        month,
        basicPay: basic,
        allowances,
        deductions,
        status: draft.status,
        paidOn: draft.status === "PAID" ? draft.paidOn : null,
        note: draft.note.trim() || null
      });
      setNotice(`Salary slip saved for ${editing.user.fullName}.`);
      closeEditor();
      await load(month);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save the slip");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing?.slip) return;
    if (!window.confirm(`Delete ${editing.user.fullName}'s slip for ${monthLabel(month)}?`)) return;

    setSaving(true);
    try {
      await payrollApi.remove(editing.slip.id);
      setNotice(`Salary slip deleted for ${editing.user.fullName}.`);
      closeEditor();
      await load(month);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to delete the slip");
    } finally {
      setSaving(false);
    }
  }

  const summary = data?.summary;
  const tiles = [
    { label: "Staff", value: summary?.staff ?? 0, bg: "bg-[#E5F7FF]" },
    { label: "Slips Recorded", value: summary?.recorded ?? 0, bg: "bg-[#F1E4FF]" },
    { label: "Paid", value: summary?.paid ?? 0, bg: "bg-[#EAF9EB]" },
    { label: "Pending", value: summary?.pending ?? 0, bg: "bg-[#FFF0E8]" },
    { label: "Total Net Pay", value: rupees(summary?.totalNetPay ?? 0), bg: "bg-[#F0E8FF]" }
  ];

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">School Management</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[#1d1d1f]">Payroll</h1>
          <p className="mt-1 text-[13px] text-[#5A6573]">Record each staff member&apos;s monthly slip. Teachers see their own slips in the app and on their dashboard.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button aria-label="Previous month" className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[#C2C9D4] bg-white text-[#2A3340] hover:bg-[#F7F8FB]" onClick={() => setMonth((current) => shiftMonth(current, -1))} type="button">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span className="min-w-[150px] text-center text-[15px] font-semibold text-[#0F1419]">{monthLabel(month)}</span>
          <button aria-label="Next month" className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[#C2C9D4] bg-white text-[#2A3340] hover:bg-[#F7F8FB]" onClick={() => setMonth((current) => shiftMonth(current, 1))} type="button">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      {error ? <div className="rounded-[8px] bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}
      {notice ? (
        <div className="flex items-center justify-between rounded-[8px] bg-[#E1F5EA] px-4 py-3 text-[13px] font-semibold text-[#0F8A4A]">
          <span>{notice}</span>
          <button className="underline-offset-2 hover:underline" onClick={() => setNotice("")} type="button">Dismiss</button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        {tiles.map((tile) => (
          <div className={`rounded-[8px] px-5 py-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] ${tile.bg}`} key={tile.label}>
            <p className="truncate text-[14px] font-medium text-[#6F7480]">{tile.label}</p>
            <p className="mt-1.5 truncate text-[22px] font-bold text-[#111827] [font-variant-numeric:tabular-nums] sm:text-[26px]">{loading ? "—" : tile.value}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-14" key={index} />)}
          </div>
        ) : !data || data.items.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] font-medium text-[#86868b]">No active staff in this school yet.</p>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-[#DCE1E8] bg-[#F7F8FB] text-[12px] font-semibold uppercase tracking-wide text-[#5A6573]">
                  <tr>
                    <th className="px-4 py-3">Staff member</th>
                    <th className="px-4 py-3 text-right">Basic</th>
                    <th className="px-4 py-3 text-right">Allowances</th>
                    <th className="px-4 py-3 text-right">Deductions</th>
                    <th className="px-4 py-3 text-right">Net pay</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF1F5]">
                  {data.items.map((row) => (
                    <tr className="hover:bg-[#FAFBFC]" key={row.user.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0F1419]">{row.user.fullName}</p>
                        <p className="text-[12px] text-[#5A6573]">{humanizeConstant(row.user.role)}</p>
                      </td>
                      <td className="px-4 py-3 text-right [font-variant-numeric:tabular-nums]">{row.slip ? rupees(row.slip.basicPay) : "—"}</td>
                      <td className="px-4 py-3 text-right [font-variant-numeric:tabular-nums]">{row.slip ? rupees(row.slip.allowances) : "—"}</td>
                      <td className="px-4 py-3 text-right [font-variant-numeric:tabular-nums]">{row.slip ? rupees(row.slip.deductions) : "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#0F1419] [font-variant-numeric:tabular-nums]">{row.slip ? rupees(row.slip.netPay) : "—"}</td>
                      <td className="px-4 py-3"><SlipStatus row={row} /></td>
                      <td className="px-4 py-3 text-right"><RowAction onOpen={() => openEditor(row)} row={row} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone: cards */}
            <div className="divide-y divide-[#EEF1F5] md:hidden">
              {data.items.map((row) => (
                <div className="flex items-center justify-between gap-3 px-4 py-3" key={row.user.id}>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#0F1419]">{row.user.fullName}</p>
                    <p className="text-[12px] text-[#5A6573]">
                      {humanizeConstant(row.user.role)}{row.slip ? ` · Net ${rupees(row.slip.netPay)}` : ""}
                    </p>
                    <div className="mt-1.5"><SlipStatus row={row} /></div>
                  </div>
                  <RowAction onOpen={() => openEditor(row)} row={row} />
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <Modal
        description={editing ? `${humanizeConstant(editing.user.role)} · ${monthLabel(month)}` : undefined}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {editing?.slip ? (
              <button className="min-h-10 rounded-[6px] px-4 text-[13px] font-semibold text-[#C8242C] hover:bg-[#FCE3E5] disabled:opacity-50" disabled={saving} onClick={remove} type="button">Delete slip</button>
            ) : <span />}
            <div className="flex gap-2">
              <button className="min-h-10 flex-1 rounded-[6px] border border-[#C2C9D4] bg-white px-4 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB] sm:flex-none" onClick={closeEditor} type="button">Cancel</button>
              <button className="min-h-10 flex-1 rounded-[6px] bg-[#2456E6] px-5 text-[13px] font-semibold text-white hover:bg-[#1B45BD] disabled:opacity-50 sm:flex-none" disabled={saving} onClick={save} type="button">{saving ? "Saving..." : "Save slip"}</button>
            </div>
          </div>
        }
        isOpen={Boolean(editing && draft)}
        onClose={closeEditor}
        title={editing ? editing.user.fullName : ""}
      >
        {draft ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                ["basicPay", "Basic pay"],
                ["allowances", "Allowances"],
                ["deductions", "Deductions"]
              ] as const).map(([key, label]) => (
                <label className="block" key={key}>
                  <span className="text-[13px] font-semibold text-[#0F1419]">{label}{key === "basicPay" ? <span className="ml-1 text-[#C8242C]">*</span> : null}</span>
                  <input
                    className={`${fieldClass} mt-1.5`}
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                    placeholder="0"
                    step="0.01"
                    type="number"
                    value={draft[key]}
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-[8px] bg-[#F7F8FB] px-4 py-3">
              <span className="text-[13px] font-semibold text-[#5A6573]">Net pay</span>
              <span className={`text-[20px] font-bold [font-variant-numeric:tabular-nums] ${netPay < 0 ? "text-[#C8242C]" : "text-[#0F1419]"}`}>{rupees(netPay)}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[13px] font-semibold text-[#0F1419]">Status</span>
                <CustomSelect
                  ariaLabel="Slip status"
                  onChange={(value) => setDraft({ ...draft, status: value as SalarySlipStatus })}
                  options={[{ label: "Paid", value: "PAID" }, { label: "Pending", value: "PENDING" }]}
                  className="h-11 w-full text-[14px]"
                  value={draft.status}
                  wrapperClassName="mt-1.5 block w-full"
                />
              </label>
              {draft.status === "PAID" ? (
                <div>
                  <span className="text-[13px] font-semibold text-[#0F1419]">Paid on</span>
                  <div className="mt-1.5">
                    <DatePicker max={todayValue()} onChange={(value) => setDraft({ ...draft, paidOn: value })} value={draft.paidOn} />
                  </div>
                </div>
              ) : null}
            </div>

            <label className="block">
              <span className="text-[13px] font-semibold text-[#0F1419]">Note</span>
              <input className={`${fieldClass} mt-1.5`} maxLength={300} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="e.g. Bank transfer, arrears included" value={draft.note} />
            </label>

            {formError ? <p className="rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[12px] font-semibold text-[#C8242C]">{formError}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function SlipStatus({ row }: { row: Row }) {
  if (!row.slip) return <StatusPill label="Not recorded" tone="neutral" />;
  return row.slip.status === "PAID"
    ? <StatusPill label={row.slip.paidOn ? `Paid ${new Date(`${row.slip.paidOn}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Paid"} tone="good" />
    : <StatusPill label="Pending" tone="warn" />;
}

function RowAction({ row, onOpen }: { row: Row; onOpen: () => void }) {
  if (!row.canEdit) {
    return <span className="text-[12px] font-medium text-[#86868b]" title="Nobody records their own salary">Your own</span>;
  }
  return (
    <button
      className={row.slip
        ? "min-h-9 shrink-0 rounded-[6px] border border-[#C2C9D4] bg-white px-3 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]"
        : "min-h-9 shrink-0 rounded-[6px] bg-[#2456E6] px-3 text-[12px] font-semibold text-white hover:bg-[#1B45BD]"}
      onClick={onOpen}
      type="button"
    >
      {row.slip ? "Edit" : "Record"}
    </button>
  );
}
