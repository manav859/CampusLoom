"use client";

import { useState } from "react";
import { SideModal } from "@/components/ui";
import { useAction } from "../_lib/action";
import { INVOICE_STATUS, SUBSCRIPTION_STATUS, fmtDate, fmtDateTime, intervalLabel, money } from "../_lib/format";
import { useResource } from "../_lib/resource";
import type { Invoice, PlanRow, SchoolBilling, SchoolUsage, SubscriptionStatus } from "../_lib/types";
import { superAdminFetch } from "../superAdminFetch";
import { InvoiceActions, invalidateBilling } from "./invoiceActions";
import { RenewModal } from "./RenewModal";
import { Badge, Btn, Checkbox, DataTable, ErrorBanner, Field, FormModal, Input, KeyValue, Select, type Column } from "./ui";

type ModalKind = "renew" | "plan" | "price" | "extend" | "status" | "invoice" | "tax";

/**
 * Everything about one school's billing, opened over whichever list the admin
 * came from. Each action is a modal; after it runs, only this school and the
 * lists it appears in are refreshed.
 */
export function SchoolBillingDrawer({ schoolId, onClose }: { schoolId: string; onClose: () => void }) {
  const detail = useResource<SchoolBilling>(`/billing/schools/${schoolId}`);
  // Reads the school's own database, so it loads separately and never blocks.
  const usage = useResource<SchoolUsage>(`/billing/schools/${schoolId}/usage`);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const data = detail.data;

  const invoiceColumns: Array<Column<Invoice>> = [
    {
      key: "invoice",
      header: "Invoice",
      cell: (invoice) => (
        <div>
          <p className="font-medium">{invoice.number}</p>
          <p className="text-xs text-slate-500">
            {fmtDate(invoice.periodStart)} – {fmtDate(invoice.periodEnd)}
          </p>
        </div>
      )
    },
    { key: "status", header: "Status", cell: (invoice) => <Badge tone={INVOICE_STATUS[invoice.status].tone}>{INVOICE_STATUS[invoice.status].label}</Badge> },
    { key: "total", header: "Total", align: "right", cell: (invoice) => <span className="font-medium tabular-nums">{money(invoice.totalMinor, invoice.currency)}</span> },
    { key: "actions", header: "", align: "right", cell: (invoice) => <InvoiceActions invoice={invoice} schoolName={data?.school.schoolName ?? ""} /> }
  ];

  const usageText = usage.data?.reachable
    ? `${usage.data.students} / ${data?.limits.maxStudents ?? "∞"} students · ${usage.data.staff} / ${data?.limits.maxStaff ?? "∞"} staff`
    : usage.isLoading
      ? "Checking…"
      : "Unavailable";

  return (
    <SideModal eyebrow={schoolId} onClose={onClose} title={data?.school.schoolName ?? "Loading…"} width="lg">
      {detail.error ? <ErrorBanner message={detail.error} onRetry={() => void detail.reload()} /> : null}
      {!data ? (
        <p className="text-sm text-slate-500">{detail.error ? "" : "Loading…"}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={SUBSCRIPTION_STATUS[data.subscription.status].tone}>{SUBSCRIPTION_STATUS[data.subscription.status].label}</Badge>
            {data.pricing.isCustomPrice ? <Badge tone="info">Custom price</Badge> : null}
            {data.subscription.cancelAtPeriodEnd ? <Badge tone="warn">Auto-renew off</Badge> : null}
          </div>

          <KeyValue
            items={[
              ["Plan", data.subscription.plan.name],
              ["Price", `${money(data.pricing.effectivePriceMinor, data.subscription.plan.currency)} ${intervalLabel(data.subscription.plan)}`],
              ["Term ends", fmtDate(data.subscription.currentPeriodEnd)],
              ["Usage", usageText]
            ]}
          />
          {data.pricing.isCustomPrice ? (
            <p className="-mt-3 text-xs text-slate-500">
              List price {money(data.pricing.listPriceMinor, data.subscription.plan.currency)}
              {data.pricing.customPriceNote ? ` · ${data.pricing.customPriceNote}` : ""}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1.5 border-y border-slate-100 py-3">
            <Btn onClick={() => setModal("renew")} size="sm" variant="primary">
              Renew
            </Btn>
            <Btn onClick={() => setModal("extend")} size="sm">
              Extend access
            </Btn>
            <Btn onClick={() => setModal("plan")} size="sm">
              Change plan
            </Btn>
            <Btn onClick={() => setModal("price")} size="sm">
              Set price
            </Btn>
            <Btn onClick={() => setModal("invoice")} size="sm">
              Raise invoice
            </Btn>
            <Btn onClick={() => setModal("status")} size="sm">
              Change status
            </Btn>
            <Btn onClick={() => setModal("tax")} size="sm">
              Tax details
            </Btn>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Invoices</h3>
            <DataTable columns={invoiceColumns} empty="No invoices yet." minWidth={560} rowKey={(invoice) => invoice.id} rows={data.invoices} />
          </section>

          <details className="rounded-md border border-slate-200 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold">Messages sent to the school ({data.notifications.length})</summary>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {data.notifications.slice(0, 15).map((notice) => (
                <li key={notice.id}>
                  <span className="font-medium text-slate-800">{fmtDateTime(notice.createdAt)}</span> ·{" "}
                  <span className={notice.status === "SENT" ? "text-green-700" : notice.status === "FAILED" ? "text-red-700" : "text-amber-700"}>
                    {notice.status.toLowerCase()}
                  </span>{" "}
                  · {notice.type.replace(/_/g, " ").toLowerCase()} · {notice.recipient || "no number on file"}
                  {notice.error ? ` · ${notice.error}` : ""}
                </li>
              ))}
              {data.notifications.length === 0 ? <li>Nothing sent yet.</li> : null}
            </ul>
          </details>

          <details className="rounded-md border border-slate-200 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold">Billing history ({data.events.length})</summary>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {data.events.slice(0, 20).map((event) => (
                <li key={event.id}>
                  <span className="font-medium text-slate-800">{fmtDateTime(event.createdAt)}</span> · {event.message}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {data && modal === "renew" ? (
        <RenewModal
          onClose={() => setModal(null)}
          target={{
            schoolId,
            schoolName: data.school.schoolName,
            planCode: data.subscription.plan.code,
            effectivePriceMinor: data.pricing.effectivePriceMinor,
            currentPeriodEnd: data.subscription.currentPeriodEnd
          }}
        />
      ) : null}
      {data && modal === "extend" ? <ExtendModal data={data} onClose={() => setModal(null)} /> : null}
      {data && modal === "plan" ? <ChangePlanModal data={data} onClose={() => setModal(null)} /> : null}
      {data && modal === "price" ? <PriceModal data={data} onClose={() => setModal(null)} /> : null}
      {data && modal === "invoice" ? <RaiseInvoiceModal data={data} onClose={() => setModal(null)} /> : null}
      {data && modal === "status" ? <StatusModal data={data} onClose={() => setModal(null)} /> : null}
      {data && modal === "tax" ? <TaxModal data={data} onClose={() => setModal(null)} /> : null}
    </SideModal>
  );
}

type ModalProps = { data: SchoolBilling; onClose: () => void };

/** Send one change for this school, refresh what it touched, close on success. */
function useSchoolChange(data: SchoolBilling, onClose: () => void) {
  const { run, isPending } = useAction();
  const schoolId = data.school.schoolId;
  const submit = async (method: "PATCH" | "POST", path: string, body: object, message: string) => {
    const done = await run(
      "school-change",
      async () => {
        await superAdminFetch(`/billing/schools/${schoolId}${path}`, { method, body: JSON.stringify(body) });
        invalidateBilling(schoolId);
        return true;
      },
      message
    );
    if (done) onClose();
  };
  return { submit, submitting: isPending("school-change") };
}

function usePlanOptions(currentCode: string) {
  const plans = useResource<PlanRow[]>("/billing/plans");
  return (plans.data ?? [])
    .filter((plan) => plan.isActive || plan.code === currentCode)
    .map((plan) => ({ value: plan.code, label: `${plan.name} (${plan.code})` }));
}

function ExtendModal({ data, onClose }: ModalProps) {
  const { submit, submitting } = useSchoolChange(data, onClose);
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("");

  return (
    <FormModal
      description="Free extra time on the current term — no invoice is raised."
      onClose={onClose}
      onSubmit={() => void submit("PATCH", "/extend", { days: Number(days), reason: reason.trim() || undefined }, `Access extended by ${days} days.`)}
      open
      submitLabel="Extend"
      submitting={submitting}
      title="Extend access"
    >
      <Field label="Extend by">
        <Select ariaLabel="Days" onChange={setDays} options={["7", "15", "30", "60", "90"].map((value) => ({ value, label: `${value} days` }))} value={days} />
      </Field>
      <Field label="Reason (optional)">
        <Input maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Waiting on their accounts team" value={reason} />
      </Field>
    </FormModal>
  );
}

function ChangePlanModal({ data, onClose }: ModalProps) {
  const { submit, submitting } = useSchoolChange(data, onClose);
  const options = usePlanOptions(data.subscription.plan.code);
  const [planCode, setPlanCode] = useState(data.subscription.plan.code);
  const [restart, setRestart] = useState(true);
  const [price, setPrice] = useState("");
  const [force, setForce] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <FormModal
      description="Moves the school straight away without billing them. To charge for a new term, use Renew instead."
      onClose={onClose}
      onSubmit={() =>
        void submit(
          "PATCH",
          "/plan",
          {
            planCode,
            restartPeriod: restart,
            customPriceRupees: price.trim() === "" ? null : Number(price),
            force,
            reason: reason.trim() || undefined
          },
          `Plan changed to ${planCode}.`
        )
      }
      open
      submitLabel="Change plan"
      submitting={submitting}
      title="Change plan"
    >
      <Field label="New plan">
        <Select ariaLabel="Plan" onChange={setPlanCode} options={options} value={planCode} />
      </Field>
      <Field hint="Leave blank to charge the plan's list price." label="Negotiated price (₹, optional)">
        <Input min={0} onChange={(event) => setPrice(event.target.value)} type="number" value={price} />
      </Field>
      <div className="space-y-1.5">
        <Checkbox checked={restart} label="Start a fresh term today" onChange={setRestart} />
        <Checkbox checked={force} label="Allow even if the school is over the plan's student/staff limits" onChange={setForce} />
      </div>
      <Field label="Reason (optional)">
        <Input maxLength={300} onChange={(event) => setReason(event.target.value)} value={reason} />
      </Field>
    </FormModal>
  );
}

function PriceModal({ data, onClose }: ModalProps) {
  const { submit, submitting } = useSchoolChange(data, onClose);
  const [price, setPrice] = useState(data.subscription.customPriceMinor === null ? "" : String(data.subscription.customPriceMinor / 100));
  const [note, setNote] = useState(data.subscription.customPriceNote ?? "");
  const clearing = price.trim() === "";

  return (
    <FormModal
      description={`Plan list price is ${money(data.pricing.listPriceMinor, data.subscription.plan.currency)}. Invoices already raised keep their amount.`}
      onClose={onClose}
      onSubmit={() =>
        void submit(
          "PATCH",
          "/price",
          { priceRupees: clearing ? null : Number(price), note: note.trim() || null },
          clearing ? "Back to the plan's list price." : `Price set to ₹${Number(price).toLocaleString("en-IN")}.`
        )
      }
      open
      submitLabel={clearing ? "Use list price" : "Save price"}
      submitting={submitting}
      title="Set this school's price"
    >
      <Field hint="Blank means the plan's list price." label="Price (₹, before GST)">
        <Input min={0} onChange={(event) => setPrice(event.target.value)} type="number" value={price} />
      </Field>
      <Field label="Note (optional)">
        <Input maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="e.g. 3-year deal" value={note} />
      </Field>
    </FormModal>
  );
}

function RaiseInvoiceModal({ data, onClose }: ModalProps) {
  const { submit, submitting } = useSchoolChange(data, onClose);
  const options = usePlanOptions(data.subscription.plan.code);
  const [planCode, setPlanCode] = useState(data.subscription.plan.code);
  const [coupon, setCoupon] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <FormModal
      description="Bills the next term. The school is notified and can pay from their Billing page."
      onClose={onClose}
      onSubmit={() =>
        void submit("POST", "/invoices", { planCode, couponCode: coupon.trim() || null, notes: notes.trim() || null }, "Invoice raised.")
      }
      open
      submitLabel="Raise invoice"
      submitting={submitting}
      title="Raise an invoice"
    >
      <Field label="Plan">
        <Select ariaLabel="Plan" onChange={setPlanCode} options={options} value={planCode} />
      </Field>
      <Field label="Coupon code (optional)">
        <Input className="uppercase" onChange={(event) => setCoupon(event.target.value)} value={coupon} />
      </Field>
      <Field label="Notes (optional)">
        <Input maxLength={500} onChange={(event) => setNotes(event.target.value)} value={notes} />
      </Field>
    </FormModal>
  );
}

function StatusModal({ data, onClose }: ModalProps) {
  const { submit, submitting } = useSchoolChange(data, onClose);
  const options = (Object.keys(SUBSCRIPTION_STATUS) as SubscriptionStatus[])
    .filter((status) => status !== data.subscription.status)
    .map((status) => ({ value: status, label: SUBSCRIPTION_STATUS[status].label }));
  const [status, setStatus] = useState<SubscriptionStatus>(options[0].value);
  const [reason, setReason] = useState("");

  return (
    <FormModal
      description={`Currently: ${SUBSCRIPTION_STATUS[data.subscription.status].label}. Expired or cancelled schools lose access.`}
      onClose={onClose}
      onSubmit={() =>
        void submit("PATCH", "/status", { status, reason: reason.trim() || undefined }, `Status set to ${SUBSCRIPTION_STATUS[status].label.toLowerCase()}.`)
      }
      open
      submitLabel="Change status"
      submitting={submitting}
      title="Change subscription status"
    >
      <Field label="New status">
        <Select ariaLabel="Status" onChange={setStatus} options={options} value={status} />
      </Field>
      <Field label="Reason (optional)">
        <Input maxLength={300} onChange={(event) => setReason(event.target.value)} value={reason} />
      </Field>
    </FormModal>
  );
}

function TaxModal({ data, onClose }: ModalProps) {
  const { submit, submitting } = useSchoolChange(data, onClose);
  const [gstin, setGstin] = useState(data.school.gstin ?? "");
  const [stateName, setStateName] = useState(data.school.stateName ?? "");
  const [stateCode, setStateCode] = useState(data.school.stateCode ?? "");

  return (
    <FormModal
      description="Printed on the GST invoice. The state code decides CGST + SGST (same state as you) or IGST (different state)."
      onClose={onClose}
      onSubmit={() =>
        void submit(
          "PATCH",
          "/tax",
          {
            gstin: gstin.trim().toUpperCase() || null,
            stateName: stateName.trim() || null,
            stateCode: stateCode.trim() || null
          },
          "Tax details saved. They appear on the next invoice PDF."
        )
      }
      open
      submitLabel="Save"
      submitting={submitting}
      title="Tax details"
    >
      <Field hint="Leave blank if the school is not GST-registered." label="GSTIN">
        <Input className="uppercase" maxLength={15} onChange={(event) => setGstin(event.target.value)} placeholder="24AABCS1429B1ZP" value={gstin} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
        <Field label="State">
          <Input onChange={(event) => setStateName(event.target.value)} placeholder="Gujarat" value={stateName} />
        </Field>
        <Field label="State code">
          <Input maxLength={2} onChange={(event) => setStateCode(event.target.value)} placeholder="24" value={stateCode} />
        </Field>
      </div>
    </FormModal>
  );
}
