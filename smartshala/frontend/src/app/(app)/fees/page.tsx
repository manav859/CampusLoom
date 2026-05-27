"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FeeCard } from "@/components/fees/FeeCard";
import { FeesTable } from "@/components/fees/FeesTable";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { DropdownItem, DropdownMenu } from "@/components/ui/DropdownMenu";
import { Modal, ModalCloseButton } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { KpiCardSkeleton, TableSkeleton, ChartSkeleton } from "@/components/ui/Skeleton";
import { feesApi, type FeeDefaulter, type FeeStructure, type FeesDashboard } from "@/lib/api";
import { formatINR, humanizeConstant } from "@/lib/formatters";
import { cachedFetch, invalidateCache } from "@/lib/prefetchCache";

type StructureForm = {
  academicYear: string;
  frequency: FeeStructure["frequency"];
  isActive: boolean;
  name: string;
  totalAmount: string;
};

function emptyForm(): StructureForm {
  return { academicYear: "", frequency: "ANNUAL", isActive: true, name: "", totalAmount: "" };
}

function agingBuckets(rows: FeeDefaulter[]) {
  return [
    { label: "0-30", value: rows.filter((row) => row.daysOverdue <= 30).length },
    { label: "31-60", value: rows.filter((row) => row.daysOverdue > 30 && row.daysOverdue <= 60).length },
    { label: "61-90", value: rows.filter((row) => row.daysOverdue > 60 && row.daysOverdue <= 90).length },
    { label: "90+", value: rows.filter((row) => row.daysOverdue > 90).length }
  ];
}

function SnapshotBar({ color, label, max, value }: { color: string; label: string; max: number; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-[13px]">
        <span className="font-semibold text-[#1d1d1f]">{label}</span>
        <span className="truncate font-semibold text-[#5A6573]">{formatINR(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#E8EDF3]">
        <div className={`h-full rounded-full ${color}`} style={{ width: value > 0 ? `${Math.max(4, Math.min((value / max) * 100, 100))}%` : "0%" }} />
      </div>
    </div>
  );
}

export default function FeesDashboardPage() {
  const [data, setData] = useState<FeesDashboard | null>(null);
  const [defaulters, setDefaulters] = useState<FeeDefaulter[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState<FeeStructure | null>(null);
  const [form, setForm] = useState<StructureForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  async function loadFees() {
    setLoading(true);
    setError("");
    try {
      const [result, structs, defaulterRows] = await Promise.all([
        cachedFetch("fees:dashboard", () => feesApi.dashboard()),
        cachedFetch("fees:structures", () => feesApi.structures()),
        cachedFetch("fees:defaulters", () => feesApi.defaulters())
      ]);
      setData(result);
      setStructures(structs ?? []);
      setDefaulters(defaulterRows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load fees dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const storedUser = window.localStorage.getItem("smartshala.user");
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setIsAdmin(u.role === "ADMIN" || u.role === "PRINCIPAL");
      } catch {
        setIsAdmin(false);
      }
    }
    loadFees();
  }, []);

  const buckets = useMemo(() => agingBuckets(defaulters), [defaulters]);
  const snapshotMax = Math.max(data?.totalCollected ?? 0, data?.totalPending ?? 0, 1);

  function openEditor(structure: FeeStructure) {
    setEditing(structure);
    setForm({
      academicYear: structure.academicYear,
      frequency: structure.frequency,
      isActive: structure.isActive,
      name: structure.name,
      totalAmount: String(structure.totalAmount)
    });
  }

  async function refreshStructures(message: string) {
    invalidateCache("fees:structures");
    const structs = await feesApi.structures();
    setStructures(structs ?? []);
    setNotice(message);
  }

  async function submitStructure(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      await feesApi.updateStructure(editing.id, {
        academicYear: form.academicYear,
        frequency: form.frequency,
        isActive: form.isActive,
        name: form.name,
        totalAmount: Number(form.totalAmount)
      });
      setEditing(null);
      await refreshStructures("Fee structure updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update fee structure");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateStructure(id: string) {
    setError("");
    try {
      await feesApi.duplicateStructure(id);
      await refreshStructures("Fee structure duplicated as an inactive draft.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to duplicate fee structure");
    }
  }

  async function archiveStructure(id: string) {
    setError("");
    try {
      await feesApi.archiveStructure(id);
      await refreshStructures("Fee structure archived.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to archive fee structure");
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Collection command center"
        action={
          <>
            {isAdmin ? <a className="btn-secondary" href="#fee-structures">Manage fee structures</a> : null}
            {isAdmin ? <Link className="btn-secondary" href="/fees/accountants/new">Add accountant</Link> : null}
            {isAdmin ? <Link className="btn-secondary" href="/fees/new">New structure</Link> : null}
            <Link className="btn-primary" href="/fees/defaulters">View defaulters</Link>
          </>
        }
      />

      {notice ? <div className="rounded-xl bg-[#E1F5EA] px-4 py-3 text-[13px] font-semibold text-[#0F8A4A]">{notice}</div> : null}
      {error ? <div className="rounded-xl bg-[#FCE3E5] px-4 py-3 text-[13px] font-medium text-[#C8242C]">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <FeeCard label="Total collection" value={formatINR(data?.totalCollected ?? 0)} tone="good" />
            <FeeCard label="Outstanding" value={formatINR(data?.totalPending ?? 0)} tone="warn" />
            <FeeCard label="Total assigned" value={formatINR(data?.totalDue ?? 0)} />
            <FeeCard label="Defaulters" value={data?.defaulterCount ?? 0} tone="danger" helper="Pending active accounts" />
          </>
        )}
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.75fr)]">
        {loading ? (
          <>
            <TableSkeleton rows={5} cols={4} />
            <ChartSkeleton height={320} />
          </>
        ) : (
          <>
            <FeesTable rows={data?.topDefaulters ?? []} loading={false} />
            <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-4 shadow-[var(--shadow-card)] sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Collection snapshot</h2>
                  <p className="mt-0.5 text-[13px] text-[#86868b]">Collected versus outstanding for the current fee ledger.</p>
                </div>
                <Link className="inline-flex min-h-9 items-center justify-center rounded-[6px] border border-[#C8242C] bg-[#C8242C] px-3 text-[12px] font-semibold text-white hover:bg-[#A91D24]" href="/fees/defaulters">
                  Defaulters
                </Link>
              </div>
              <div className="mt-5 space-y-4 rounded-[8px] border border-[#E2E7EE] bg-[#FAFBFC] p-4">
                <SnapshotBar color="bg-[#0F8A4A]" label="Collected" max={snapshotMax} value={data?.totalCollected ?? 0} />
                <SnapshotBar color="bg-[#B95A00]" label="Outstanding" max={snapshotMax} value={data?.totalPending ?? 0} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {buckets.map((bucket) => (
                  <div className="rounded-[8px] border border-[#DCE1E8] bg-white px-3 py-3" key={bucket.label} title="Aging bucket by days overdue">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">{bucket.label} days</p>
                    <p className="mt-1 text-[20px] font-bold text-[#0F1419]">{bucket.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2">
                <Link className="flex min-h-11 items-center justify-between rounded-[6px] border border-[#DCE1E8] bg-white px-4 py-3 text-[13px] font-semibold text-[#2456E6] transition-colors hover:bg-[#F7F8FB]" href="/fees/defaulters" title="Queue of students needing fee follow-up">
                  Open defaulter follow-up queue
                  <span className="text-[#86868b]">View</span>
                </Link>
                {isAdmin ? (
                  <Link className="flex min-h-11 items-center justify-between rounded-[6px] border border-[#DCE1E8] bg-white px-4 py-3 text-[13px] font-semibold text-[#2456E6] transition-colors hover:bg-[#F7F8FB]" href="/notifications" title="Receipt and WhatsApp delivery audit trail">
                    Review WhatsApp receipts
                    <span className="text-[#86868b]">Open</span>
                  </Link>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="space-y-4 pt-4" id="fee-structures">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Fee structures</h2>
            <p className="text-[13px] text-[#86868b]">Edit active structures, duplicate drafts, or archive old plans.</p>
          </div>
          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Link className="btn-secondary min-h-10 px-4 text-[13px]" href="/fees/new">Create new</Link>
            </div>
          ) : null}
        </div>
        <div className="space-y-3 sm:hidden">
          {loading ? (
            <TableSkeleton rows={3} cols={2} />
          ) : structures.length === 0 ? (
            <div className="rounded-[8px] border border-[#DCE1E8] bg-white px-4 py-10 text-center text-[13px] text-[#86868b]">No fee structures found. Create one to get started.</div>
          ) : (
            structures.map((row) => (
              <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-4 shadow-[var(--shadow-card)]" key={row.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#1d1d1f]">{row.name}</p>
                    <p className="mt-1 text-[12px] text-[#86868b]">{row.academicYear} - {humanizeConstant(row.frequency)}</p>
                  </div>
                  <StatusPill label={row.isActive ? "Active" : "Archived"} tone={row.isActive ? "good" : "neutral"} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">Total</p>
                    <p className="mt-1 font-semibold text-[#0F1419]">{formatINR(Number(row.totalAmount))}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">Class</p>
                    <p className="mt-1 font-semibold text-[#0F1419]">{row.class ? `${row.class.name}-${row.class.section}` : "All classes"}</p>
                  </div>
                </div>
                {isAdmin ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="min-h-9 rounded-[6px] border border-[#C2C9D4] px-3 text-[12px] font-semibold text-[#2A3340]" onClick={() => openEditor(row)} type="button">Edit</button>
                    <button className="min-h-9 rounded-[6px] border border-[#C2C9D4] px-3 text-[12px] font-semibold text-[#2A3340]" onClick={() => duplicateStructure(row.id)} type="button">Duplicate</button>
                    <button className="min-h-9 rounded-[6px] border border-[#F0B8BE] px-3 text-[12px] font-semibold text-[#C8242C]" onClick={() => archiveStructure(row.id)} type="button">Archive</button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
        <div className="hidden sm:block">
          {loading ? (
            <TableSkeleton rows={4} cols={6} />
          ) : (
            <DataTable
              rows={structures}
              getRowKey={(row) => row.id}
              columns={[
                { key: "name", header: "Structure", render: (row) => <span className="font-semibold text-[#1d1d1f]">{row.name}</span> },
                { key: "year", header: "Academic year", render: (row) => row.academicYear },
                { key: "amount", header: "Total", render: (row) => formatINR(Number(row.totalAmount)) },
                { key: "frequency", header: "Frequency", render: (row) => humanizeConstant(row.frequency) },
                { key: "class", header: "Class", render: (row) => row.class ? `${row.class.name}-${row.class.section}` : "All classes" },
                { key: "status", header: "Status", render: (row) => <StatusPill label={row.isActive ? "Active" : "Archived"} tone={row.isActive ? "good" : "neutral"} /> },
                {
                  key: "actions",
                  header: "Actions",
                  align: "right",
                  render: (row) => isAdmin ? (
                    <DropdownMenu label="Manage">
                      <DropdownItem onClick={() => openEditor(row)}>Edit</DropdownItem>
                      <DropdownItem onClick={() => duplicateStructure(row.id)}>Duplicate</DropdownItem>
                      <DropdownItem destructive onClick={() => archiveStructure(row.id)}>Archive</DropdownItem>
                    </DropdownMenu>
                  ) : "-"
                }
              ]}
              empty="No fee structures found. Create one to get started."
            />
          )}
        </div>
      </section>

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit fee structure"
        description="Changes affect the fee plan definition. Existing student ledgers keep their recorded payments."
        footer={
          <>
            <ModalCloseButton onClick={() => setEditing(null)} />
            <Button form="fee-structure-edit" isLoading={saving} type="submit">Save changes</Button>
          </>
        }
      >
        <form className="grid gap-4 sm:grid-cols-2" id="fee-structure-edit" onSubmit={submitStructure}>
          <label className="sm:col-span-2">
            <span className="text-[13px] font-semibold text-[#1d1d1f]">Structure name</span>
            <input className="glass-input mt-2" onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
          </label>
          <label>
            <span className="text-[13px] font-semibold text-[#1d1d1f]">Academic year</span>
            <input className="glass-input mt-2" onChange={(event) => setForm({ ...form, academicYear: event.target.value })} required value={form.academicYear} />
          </label>
          <label>
            <span className="text-[13px] font-semibold text-[#1d1d1f]">Total amount</span>
            <input className="glass-input mt-2" min={1} onChange={(event) => setForm({ ...form, totalAmount: event.target.value })} required type="number" value={form.totalAmount} />
          </label>
          <label>
            <span className="text-[13px] font-semibold text-[#1d1d1f]">Frequency</span>
            <select className="glass-input mt-2" onChange={(event) => setForm({ ...form, frequency: event.target.value as FeeStructure["frequency"] })} value={form.frequency}>
              {["ANNUAL", "QUARTERLY", "MONTHLY", "BIANNUAL", "CUSTOM"].map((frequency) => (
                <option key={frequency} value={frequency}>{humanizeConstant(frequency)}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 pt-7">
            <input checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} type="checkbox" />
            <span className="text-[13px] font-semibold text-[#1d1d1f]">Active</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
