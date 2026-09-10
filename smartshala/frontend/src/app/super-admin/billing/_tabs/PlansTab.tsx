"use client";

import { useState } from "react";
import { useAction } from "../../_lib/action";
import { intervalLabel, money } from "../../_lib/format";
import { invalidate, setResource, useResource } from "../../_lib/resource";
import type { Plan, PlanRow } from "../../_lib/types";
import { superAdminFetch } from "../../superAdminFetch";
import {
  Badge,
  Btn,
  Checkbox,
  ConfirmModal,
  DataTable,
  ErrorBanner,
  Field,
  FormModal,
  Input,
  RowActions,
  Select,
  Toolbar,
  type Column
} from "../../_components/ui";

const KEY = "/billing/plans";

export function PlansTab() {
  const plans = useResource<PlanRow[]>(KEY);
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);
  const [removing, setRemoving] = useState<PlanRow | null>(null);

  const columns: Array<Column<PlanRow>> = [
    {
      key: "plan",
      header: "Plan",
      cell: (plan) => (
        <div className="min-w-0">
          <p className="font-medium">{plan.name}</p>
          <p className="text-xs text-slate-500">
            {plan.code}
            {plan.description ? ` · ${plan.description}` : ""}
          </p>
        </div>
      )
    },
    {
      key: "price",
      header: "Price",
      cell: (plan) => (
        <span className="whitespace-nowrap">
          <span className="font-medium tabular-nums">{money(plan.priceMinor, plan.currency)}</span>{" "}
          <span className="text-xs text-slate-500">{intervalLabel(plan)}</span>
        </span>
      )
    },
    {
      key: "limits",
      header: "Limits",
      cell: (plan) => (
        <span className="text-xs text-slate-600">
          {plan.maxStudents ?? "Unlimited"} students · {plan.maxStaff ?? "Unlimited"} staff
          {plan.trialDays ? ` · ${plan.trialDays}-day trial` : ""}
        </span>
      )
    },
    { key: "schools", header: "Schools", align: "right", cell: (plan) => <span className="tabular-nums">{plan.subscriberCount}</span> },
    {
      key: "visibility",
      header: "Shown to schools",
      cell: (plan) =>
        !plan.isActive ? <Badge>Archived</Badge> : plan.isPublic ? <Badge tone="good">Yes</Badge> : <Badge tone="info">Internal only</Badge>
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (plan) => (
        <RowActions>
          <Btn onClick={() => setEditing(plan)} size="sm">
            Edit
          </Btn>
          <Btn onClick={() => setRemoving(plan)} size="sm" variant="danger">
            Remove
          </Btn>
        </RowActions>
      )
    }
  ];

  return (
    <>
      <Toolbar className="justify-between">
        <p className="text-sm text-slate-500">What schools can subscribe to. Prices are before GST.</p>
        <Btn onClick={() => setEditing("new")} variant="primary">
          + Create plan
        </Btn>
      </Toolbar>
      {plans.error ? <ErrorBanner message={plans.error} onRetry={() => void plans.reload()} /> : null}
      <DataTable columns={columns} empty="No plans yet — create the first one." loading={plans.isLoading} minWidth={760} rowKey={(plan) => plan.id} rows={plans.data} />

      {editing ? <PlanFormModal onClose={() => setEditing(null)} plan={editing === "new" ? null : editing} /> : null}
      {removing ? <RemovePlanModal onClose={() => setRemoving(null)} plan={removing} /> : null}
    </>
  );
}

function PlanFormModal({ plan, onClose }: { plan: PlanRow | null; onClose: () => void }) {
  const { run, isPending } = useAction();
  const [draft, setDraft] = useState({
    code: plan?.code ?? "",
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    price: plan ? String(plan.priceMinor / 100) : "",
    interval: (plan?.interval ?? "YEAR") as Plan["interval"],
    trialDays: String(plan?.trialDays ?? 0),
    maxStudents: plan?.maxStudents == null ? "" : String(plan.maxStudents),
    maxStaff: plan?.maxStaff == null ? "" : String(plan.maxStaff),
    sortOrder: String(plan?.sortOrder ?? 0),
    isActive: plan?.isActive ?? true,
    isPublic: plan?.isPublic ?? true
  });
  const set = (patch: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...patch }));
  const valid = draft.name.trim().length >= 2 && draft.price.trim() !== "" && (plan || draft.code.trim().length >= 2);

  return (
    <FormModal
      onClose={onClose}
      onSubmit={async () => {
        const body = {
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          priceRupees: Number(draft.price),
          interval: draft.interval,
          intervalCount: plan?.intervalCount ?? 1,
          trialDays: Number(draft.trialDays) || 0,
          maxStudents: draft.maxStudents === "" ? null : Number(draft.maxStudents),
          maxStaff: draft.maxStaff === "" ? null : Number(draft.maxStaff),
          isActive: draft.isActive,
          isPublic: draft.isPublic,
          sortOrder: Number(draft.sortOrder) || 0
        };
        const saved = await run(
          "save-plan",
          async () => {
            const result = plan
              ? await superAdminFetch<Plan>(`${KEY}/${plan.id}`, { method: "PATCH", body: JSON.stringify(body) })
              : await superAdminFetch<Plan>(KEY, { method: "POST", body: JSON.stringify({ code: draft.code.trim().toUpperCase(), ...body }) });
            // Show the saved plan immediately; the refetch only fills in counts.
            setResource<PlanRow[]>(KEY, (current = []) =>
              plan
                ? current.map((row) => (row.id === result.id ? { ...row, ...result } : row))
                : [...current, { ...result, subscriberCount: 0 }]
            );
            invalidate(KEY);
            return result;
          },
          plan ? "Plan updated." : "Plan created."
        );
        if (saved) onClose();
      }}
      open
      size="lg"
      submitDisabled={!valid}
      submitLabel={plan ? "Save changes" : "Create plan"}
      submitting={isPending("save-plan")}
      title={plan ? `Edit ${plan.name}` : "Create a plan"}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field hint={plan ? "Codes cannot change once created." : "Short and unique, e.g. GROWTH."} label="Code">
          <Input className="uppercase" disabled={Boolean(plan)} onChange={(event) => set({ code: event.target.value })} value={draft.code} />
        </Field>
        <Field label="Name">
          <Input autoFocus onChange={(event) => set({ name: event.target.value })} placeholder="Growth" value={draft.name} />
        </Field>
        <Field label="Price (₹, before GST)">
          <Input min={0} onChange={(event) => set({ price: event.target.value })} step="0.01" type="number" value={draft.price} />
        </Field>
        <Field label="Billed">
          <Select
            ariaLabel="Billing interval"
            onChange={(interval) => set({ interval })}
            options={[
              { value: "YEAR", label: "Yearly" },
              { value: "MONTH", label: "Monthly" }
            ]}
            value={draft.interval}
          />
        </Field>
        <Field hint="Blank = unlimited" label="Max students">
          <Input min={1} onChange={(event) => set({ maxStudents: event.target.value })} type="number" value={draft.maxStudents} />
        </Field>
        <Field hint="Blank = unlimited" label="Max staff">
          <Input min={1} onChange={(event) => set({ maxStaff: event.target.value })} type="number" value={draft.maxStaff} />
        </Field>
        <Field label="Free trial (days)">
          <Input min={0} onChange={(event) => set({ trialDays: event.target.value })} type="number" value={draft.trialDays} />
        </Field>
        <Field hint="Lower shows first" label="Display order">
          <Input min={0} onChange={(event) => set({ sortOrder: event.target.value })} type="number" value={draft.sortOrder} />
        </Field>
        <Field className="sm:col-span-2" label="Description (optional)">
          <Input maxLength={500} onChange={(event) => set({ description: event.target.value })} value={draft.description} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <Checkbox checked={draft.isActive} label="Active" onChange={(isActive) => set({ isActive })} />
        <Checkbox checked={draft.isPublic} label="Shown to schools" onChange={(isPublic) => set({ isPublic })} />
      </div>
    </FormModal>
  );
}

function RemovePlanModal({ plan, onClose }: { plan: PlanRow; onClose: () => void }) {
  const { run, isPending } = useAction();
  const inUse = plan.subscriberCount > 0;

  return (
    <ConfirmModal
      busy={isPending("remove-plan")}
      confirmLabel={inUse ? "Archive plan" : "Remove plan"}
      danger
      message={
        inUse
          ? `${plan.subscriberCount} school${plan.subscriberCount === 1 ? " is" : "s are"} on ${plan.name}, so it will be archived: they keep it, but no one new can choose it.`
          : `${plan.name} is not in use and will be removed.`
      }
      onClose={onClose}
      onConfirm={async () => {
        const done = await run(
          "remove-plan",
          async () => {
            const result = await superAdminFetch<{ deleted: boolean; plan: Plan }>(`${KEY}/${plan.id}`, { method: "DELETE" });
            setResource<PlanRow[]>(KEY, (current = []) =>
              result.deleted ? current.filter((row) => row.id !== plan.id) : current.map((row) => (row.id === plan.id ? { ...row, ...result.plan } : row))
            );
            return result;
          },
          (result) => (result.deleted ? `${plan.name} removed.` : `${plan.name} archived.`)
        );
        if (done) onClose();
      }}
      open
      title={inUse ? `Archive ${plan.name}?` : `Remove ${plan.name}?`}
    />
  );
}
