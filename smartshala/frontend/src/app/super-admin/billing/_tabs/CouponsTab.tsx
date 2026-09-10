"use client";

import { useState } from "react";
import { useAction } from "../../_lib/action";
import { fmtDate, money } from "../../_lib/format";
import { invalidate, setResource, useResource } from "../../_lib/resource";
import type { Coupon } from "../../_lib/types";
import { superAdminFetch } from "../../superAdminFetch";
import { Badge, Btn, ConfirmModal, DataTable, ErrorBanner, Field, FormModal, Input, RowActions, Select, Toolbar, type Column } from "../../_components/ui";

const KEY = "/billing/coupons";

function discountText(coupon: Coupon) {
  return coupon.discountType === "PERCENTAGE" ? `${Number(coupon.discountValue)}% off` : `${money(Number(coupon.discountValue) * 100)} off`;
}

export function CouponsTab() {
  const coupons = useResource<Coupon[]>(KEY);
  const { run, isPending } = useAction();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  function toggle(coupon: Coupon) {
    setResource<Coupon[]>(KEY, (current = []) => current.map((row) => (row.id === coupon.id ? { ...row, isActive: !coupon.isActive } : row)));
    void run(
      `toggle-${coupon.id}`,
      async () => {
        try {
          await superAdminFetch(`${KEY}/${coupon.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !coupon.isActive }) });
        } catch (error) {
          invalidate(KEY);
          throw error;
        }
      },
      `${coupon.code} ${coupon.isActive ? "disabled" : "enabled"}.`
    );
  }

  const columns: Array<Column<Coupon>> = [
    {
      key: "code",
      header: "Code",
      cell: (coupon) => (
        <div className="min-w-0">
          <p className="font-mono font-medium">{coupon.code}</p>
          {coupon.description ? <p className="text-xs text-slate-500">{coupon.description}</p> : null}
        </div>
      )
    },
    { key: "discount", header: "Discount", cell: discountText },
    {
      key: "used",
      header: "Used",
      cell: (coupon) => (
        <span className="tabular-nums">
          {coupon.redeemedCount}
          {coupon.maxRedemptions === null ? "" : ` of ${coupon.maxRedemptions}`}
        </span>
      )
    },
    { key: "expires", header: "Expires", cell: (coupon) => <span className="text-slate-600">{coupon.expiresAt ? fmtDate(coupon.expiresAt) : "Never"}</span> },
    { key: "status", header: "Status", cell: (coupon) => <Badge tone={coupon.isActive ? "good" : "neutral"}>{coupon.isActive ? "Active" : "Disabled"}</Badge> },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (coupon) => (
        <RowActions>
          <Btn disabled={isPending(`toggle-${coupon.id}`)} onClick={() => toggle(coupon)} size="sm">
            {coupon.isActive ? "Disable" : "Enable"}
          </Btn>
          <Btn onClick={() => setDeleting(coupon)} size="sm" variant="danger">
            Delete
          </Btn>
        </RowActions>
      )
    }
  ];

  return (
    <>
      <Toolbar className="justify-between">
        <p className="text-sm text-slate-500">Discount codes schools or you can apply to an invoice.</p>
        <Btn onClick={() => setCreating(true)} variant="primary">
          + Create coupon
        </Btn>
      </Toolbar>
      {coupons.error ? <ErrorBanner message={coupons.error} onRetry={() => void coupons.reload()} /> : null}
      <DataTable columns={columns} empty="No coupons yet." loading={coupons.isLoading} rowKey={(coupon) => coupon.id} rows={coupons.data} />

      {creating ? <CouponFormModal onClose={() => setCreating(false)} /> : null}
      <ConfirmModal
        busy={isPending("delete-coupon")}
        confirmLabel="Delete"
        danger
        message={`Schools will no longer be able to use ${deleting?.code}.`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const target = deleting;
          const done = await run(
            "delete-coupon",
            async () => {
              await superAdminFetch(`${KEY}/${target.id}`, { method: "DELETE" });
              setResource<Coupon[]>(KEY, (current = []) => current.filter((row) => row.id !== target.id));
              return true;
            },
            `${target.code} deleted.`
          );
          if (done) setDeleting(null);
        }}
        open={Boolean(deleting)}
        title={`Delete ${deleting?.code ?? "coupon"}?`}
      />
    </>
  );
}

function CouponFormModal({ onClose }: { onClose: () => void }) {
  const { run, isPending } = useAction();
  const [draft, setDraft] = useState({
    code: "",
    description: "",
    discountType: "PERCENTAGE" as Coupon["discountType"],
    value: "10",
    maxRedemptions: "",
    expiresAt: ""
  });
  const set = (patch: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...patch }));
  const value = Number(draft.value);
  const valid = draft.code.trim().length >= 3 && Number.isFinite(value) && value > 0 && (draft.discountType === "FIXED" || value <= 100);

  return (
    <FormModal
      onClose={onClose}
      onSubmit={async () => {
        const created = await run(
          "create-coupon",
          async () => {
            const coupon = await superAdminFetch<Coupon>(KEY, {
              method: "POST",
              body: JSON.stringify({
                code: draft.code.trim().toUpperCase(),
                description: draft.description.trim() || null,
                discountType: draft.discountType,
                discountValue: value,
                maxRedemptions: draft.maxRedemptions === "" ? null : Number(draft.maxRedemptions),
                isActive: true,
                // End of the chosen day, so "expires 31 Dec" still works on 31 Dec.
                expiresAt: draft.expiresAt ? new Date(`${draft.expiresAt}T23:59:59`).toISOString() : null
              })
            });
            setResource<Coupon[]>(KEY, (current = []) => [coupon, ...current]);
            return coupon;
          },
          (coupon) => `${coupon.code} created.`
        );
        if (created) onClose();
      }}
      open
      submitDisabled={!valid}
      submitLabel="Create coupon"
      submitting={isPending("create-coupon")}
      title="Create a coupon"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Code">
          <Input autoFocus className="uppercase" onChange={(event) => set({ code: event.target.value })} placeholder="LAUNCH25" value={draft.code} />
        </Field>
        <Field label="Type">
          <Select
            ariaLabel="Discount type"
            onChange={(discountType) => set({ discountType })}
            options={[
              { value: "PERCENTAGE", label: "Percentage off" },
              { value: "FIXED", label: "Flat ₹ off" }
            ]}
            value={draft.discountType}
          />
        </Field>
        <Field label={draft.discountType === "PERCENTAGE" ? "Discount (%)" : "Discount (₹)"}>
          <Input min={0} onChange={(event) => set({ value: event.target.value })} type="number" value={draft.value} />
        </Field>
        <Field hint="Blank = no limit" label="Max uses">
          <Input min={1} onChange={(event) => set({ maxRedemptions: event.target.value })} type="number" value={draft.maxRedemptions} />
        </Field>
        <Field hint="Blank = never expires" label="Expires on">
          <Input onChange={(event) => set({ expiresAt: event.target.value })} type="date" value={draft.expiresAt} />
        </Field>
        <Field label="Description (optional)">
          <Input maxLength={300} onChange={(event) => set({ description: event.target.value })} value={draft.description} />
        </Field>
      </div>
    </FormModal>
  );
}
