"use client";

import { useState } from "react";
import { useAction } from "../_lib/action";
import { fmtDate, intervalLabel } from "../_lib/format";
import { useResource } from "../_lib/resource";
import type { OfflineMethod, PaymentLinkRow, PlanRow, RenewalCollection, RenewResult } from "../_lib/types";
import { superAdminFetch } from "../superAdminFetch";
import { invalidateBilling, LinkReadyModal, OFFLINE_METHOD_OPTIONS } from "./invoiceActions";
import { Callout, Field, FormModal, Input, Select, TextArea, cx } from "./ui";

export type RenewTarget = {
  schoolId: string;
  schoolName: string;
  planCode: string;
  effectivePriceMinor: number;
  currentPeriodEnd: string;
};

const COLLECT_OPTIONS: Array<{ value: RenewalCollection; title: string; body: string; submit: string }> = [
  {
    value: "PAYMENT_LINK",
    title: "Send a payment link",
    body: "You get a link to share on WhatsApp or email. Access renews the moment they pay online.",
    submit: "Create payment link"
  },
  {
    value: "PAID_OFFLINE",
    title: "They have already paid",
    body: "Bank transfer, cheque or cash. Access renews right away.",
    submit: "Renew now"
  },
  {
    value: "INVOICE_ONLY",
    title: "Only raise the invoice",
    body: "They pay later from their own Billing page.",
    submit: "Raise invoice"
  }
];

function termEnd(start: Date, plan: Pick<PlanRow, "interval" | "intervalCount">) {
  const end = new Date(start);
  if (plan.interval === "MONTH") end.setMonth(end.getMonth() + plan.intervalCount);
  else end.setFullYear(end.getFullYear() + plan.intervalCount);
  return end;
}

/**
 * Renewal in one form: plan, price, and how the money comes in. The server
 * raises (or reuses) the invoice and, depending on the choice, issues the
 * payment link or records the offline payment — one request, one click.
 */
export function RenewModal({ target, onClose }: { target: RenewTarget; onClose: () => void }) {
  const plans = useResource<PlanRow[]>("/billing/plans");
  const { run, isPending } = useAction();
  const [planCode, setPlanCode] = useState(target.planCode);
  const [price, setPrice] = useState(String(target.effectivePriceMinor / 100));
  const [collect, setCollect] = useState<RenewalCollection>("PAYMENT_LINK");
  const [method, setMethod] = useState<OfflineMethod>("neft");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState<PaymentLinkRow | null>(null);

  if (link) return <LinkReadyModal link={link} onClose={onClose} schoolName={target.schoolName} />;

  const plan = plans.data?.find((row) => row.code === planCode);
  const planOptions = (plans.data ?? [])
    .filter((row) => row.isActive || row.code === target.planCode)
    .map((row) => ({ value: row.code, label: `${row.name} (${row.code})` }));

  const now = new Date();
  const lastEnd = new Date(target.currentPeriodEnd);
  const start = lastEnd > now ? lastEnd : now;
  const rupees = Number(price);
  const valid = Boolean(plan) && price.trim() !== "" && Number.isFinite(rupees) && rupees >= 0;
  const chosen = COLLECT_OPTIONS.find((option) => option.value === collect)!;

  function pickPlan(code: string) {
    setPlanCode(code);
    const next = plans.data?.find((row) => row.code === code);
    // Back on their own plan, offer their agreed rate; otherwise the list price.
    if (next) setPrice(String((code === target.planCode ? target.effectivePriceMinor : next.priceMinor) / 100));
  }

  return (
    <FormModal
      description={target.schoolName}
      onClose={onClose}
      onSubmit={async () => {
        const result = await run(
          "renew",
          async () => {
            const response = await superAdminFetch<RenewResult>(`/billing/schools/${target.schoolId}/renew`, {
              method: "POST",
              body: JSON.stringify({
                planCode,
                priceRupees: rupees,
                collect,
                offlineMethod: collect === "PAID_OFFLINE" ? method : undefined,
                offlineReference: collect === "PAID_OFFLINE" ? reference.trim() || null : null,
                note: note.trim() || null
              })
            });
            invalidateBilling(target.schoolId);
            return response;
          },
          (response) => {
            const done =
              collect === "PAID_OFFLINE"
                ? `${target.schoolName} renewed until ${fmtDate(response.invoice.periodEnd)}.`
                : collect === "INVOICE_ONLY"
                  ? `Invoice ${response.invoice.number} ${response.reusedInvoice ? "was already open — reused it" : "raised"}.`
                  : `Payment link ready for ${response.invoice.number}.`;
            const superseded = response.supersededInvoices.length
              ? ` Older unpaid invoice ${response.supersededInvoices.join(", ")} was voided so they can't pay twice.`
              : "";
            return done + superseded;
          }
        );
        if (!result) return;
        if (result.paymentLink) setLink(result.paymentLink);
        else onClose();
      }}
      open
      size="lg"
      submitDisabled={!valid}
      submitLabel={chosen.submit}
      submitting={isPending("renew")}
      title="Renew subscription"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Plan">
          {plans.isLoading ? (
            <Input disabled value="Loading plans…" />
          ) : (
            <Select ariaLabel="Plan" onChange={pickPlan} options={planOptions} value={planCode} />
          )}
        </Field>
        <Field hint={plan ? `${intervalLabel(plan)} · GST is added on the invoice` : undefined} label="Price (₹, before GST)">
          <Input min={0} onChange={(event) => setPrice(event.target.value)} step="0.01" type="number" value={price} />
        </Field>
      </div>

      {plan ? (
        <Callout>
          New term: <strong>{fmtDate(start.toISOString())}</strong> to <strong>{fmtDate(termEnd(start, plan).toISOString())}</strong>
          {lastEnd > now ? " — starts when the current one ends." : "."}
        </Callout>
      ) : null}

      <fieldset>
        <legend className="text-xs font-semibold text-slate-700">How are they paying?</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          {COLLECT_OPTIONS.map((option) => (
            <label
              className={cx(
                "cursor-pointer rounded-md border p-2.5 transition-colors",
                collect === option.value ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 hover:bg-slate-50"
              )}
              key={option.value}
            >
              <input
                checked={collect === option.value}
                className="sr-only"
                name="collect"
                onChange={() => setCollect(option.value)}
                type="radio"
              />
              <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
              <span className="mt-0.5 block text-xs text-slate-600">{option.body}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {collect === "PAID_OFFLINE" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Paid by">
            <Select ariaLabel="Payment method" onChange={setMethod} options={OFFLINE_METHOD_OPTIONS} value={method} />
          </Field>
          <Field label="Reference (optional)">
            <Input maxLength={120} onChange={(event) => setReference(event.target.value)} placeholder="UTR / cheque no." value={reference} />
          </Field>
        </div>
      ) : null}

      <Field label="Note (optional)">
        <TextArea maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="Shown on the invoice and payment page" value={note} />
      </Field>
    </FormModal>
  );
}
