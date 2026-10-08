"use client";

import { useState } from "react";
import { Badge, Btn, Card, CardHeader, ConfirmModal, CopyButton, Field, FormModal, Input, Select, TextArea, cx } from "../../../super-admin/_components/ui";
import { useAction } from "../../../super-admin/_lib/action";
import { fmtDate, fmtDateTime, intervalLabel, money, timeAgo, type Tone } from "../../../super-admin/_lib/format";
import { crmDownload, crmFetch } from "../../crmFetch";
import { ONBOARDING, PAYMENT_STATUS, whatsappUrl } from "../../_lib/format";
import { invalidate, useResource } from "../../_lib/resource";
import type { LeadDetail, PaymentLink, Plan, Proforma } from "../../_lib/types";

const PROFORMA_STATUS: Record<Proforma["status"], { label: string; tone: Tone }> = {
  ISSUED: { label: "Awaiting payment", tone: "warn" },
  PAID: { label: "Paid", tone: "good" },
  CANCELLED: { label: "Cancelled", tone: "neutral" }
};

/**
 * Everything money on a lead: the proforma, the link that pays it, and — once
 * paid — the school it became. Each action refreshes this lead and the list.
 */
export function BillingPanel({ lead }: { lead: LeadDetail }) {
  const [issuing, setIssuing] = useState(false);
  const current = lead.proformas.find((proforma) => proforma.status !== "CANCELLED") ?? null;
  const cancelled = lead.proformas.filter((proforma) => proforma.status === "CANCELLED");
  const paid = lead.stage === "PAID" || lead.stage === "ONBOARDED";

  return (
    <div className="min-w-0 space-y-4 self-start">
      {paid ? <SchoolCard lead={lead} /> : null}

      {current ? (
        <ProformaCard lead={lead} onRevise={() => setIssuing(true)} proforma={current} />
      ) : (
        <Card>
          <CardHeader title="Proforma invoice" />
          <div className="p-4 text-sm text-slate-600">
            {lead.stage === "LOST" ? (
              "Reopen the lead to send it a proforma."
            ) : (
              <>
                <p>Quote a plan and price. The proforma goes to the principal with a link to pay it.</p>
                <Btn className="mt-3" onClick={() => setIssuing(true)} variant="primary">
                  Issue proforma
                </Btn>
              </>
            )}
          </div>
        </Card>
      )}

      {cancelled.length ? (
        <Card>
          <CardHeader title="Earlier proformas" />
          <ul className="divide-y divide-slate-100">
            {cancelled.map((proforma) => (
              <li className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm" key={proforma.id}>
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{proforma.number}</p>
                  <p className="text-xs text-slate-500">
                    {proforma.planName} · {fmtDate(proforma.issuedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-slate-500 line-through">{money(proforma.totalMinor, proforma.currency)}</span>
                  <PdfButton proforma={proforma} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {issuing ? <IssueProformaModal lead={lead} onClose={() => setIssuing(false)} revising={current?.status === "ISSUED"} /> : null}
    </div>
  );
}

function refreshLead(leadId: string) {
  invalidate(`/leads/${leadId}`, "/leads", "/payments");
}

function PdfButton({ proforma }: { proforma: Proforma }) {
  const { run, isPending } = useAction();
  return (
    <Btn
      loading={isPending("pdf")}
      onClick={() => void run("pdf", () => crmDownload(`/proformas/${proforma.id}/pdf`, `proforma-${proforma.number}.pdf`))}
      size="sm"
    >
      PDF
    </Btn>
  );
}

function ProformaCard({ lead, proforma, onRevise }: { lead: LeadDetail; proforma: Proforma; onRevise: () => void }) {
  const { run, isPending } = useAction();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const status = PROFORMA_STATUS[proforma.status];
  const offPercent = proforma.listPriceMinor > proforma.subtotalMinor ? Math.round((1 - proforma.subtotalMinor / proforma.listPriceMinor) * 100) : 0;
  const open = proforma.status === "ISSUED";

  return (
    <Card>
      <CardHeader
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
        description={`Issued ${fmtDate(proforma.issuedAt)} by ${proforma.createdBy}${open ? ` · valid until ${fmtDate(proforma.validUntil)}` : ""}`}
        title={`Proforma ${proforma.number}`}
      />
      <div className="space-y-3 p-4">
        <div className="rounded-lg border border-slate-200">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
            <p className="min-w-0 text-sm font-semibold text-slate-900">{proforma.planName} ×1</p>
            <div className="flex shrink-0 items-center gap-2">
              {offPercent > 0 ? <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-bold text-green-700">{offPercent}% off</span> : null}
              <span className="text-sm font-semibold tabular-nums">{money(proforma.subtotalMinor, proforma.currency)}</span>
              {offPercent > 0 ? <span className="text-xs tabular-nums text-slate-400 line-through">{money(proforma.listPriceMinor, proforma.currency)}</span> : null}
            </div>
          </div>
          <dl className="space-y-1.5 px-3 py-2.5 text-sm">
            {proforma.discountMinor > 0 ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">Coupon {proforma.couponCode}</dt>
                <dd className="tabular-nums text-green-700">−{money(proforma.discountMinor, proforma.currency)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-slate-500">Total after discount</dt>
              <dd className="tabular-nums">{money(proforma.subtotalMinor - proforma.discountMinor, proforma.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">GST</dt>
              <dd className="tabular-nums">{money(proforma.taxMinor, proforma.currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1.5 font-semibold">
              <dt>Payable amount</dt>
              <dd className="tabular-nums">{money(proforma.totalMinor, proforma.currency)}</dd>
            </div>
          </dl>
        </div>
        {proforma.notes ? <p className="text-xs text-slate-500">Note: {proforma.notes}</p> : null}

        <div className="flex flex-wrap gap-2">
          <PdfButton proforma={proforma} />
          {proforma.invoice ? (
            <Btn
              loading={isPending("invoice")}
              onClick={() =>
                void run("invoice", () => crmDownload(`/invoices/${proforma.invoice!.id}/pdf`, `invoice-${proforma.invoice!.number}.pdf`))
              }
              size="sm"
            >
              Tax invoice {proforma.invoice.number}
            </Btn>
          ) : null}
          {open ? (
            <>
              <Btn onClick={onRevise} size="sm">
                Revise
              </Btn>
              <Btn onClick={() => setConfirmCancel(true)} size="sm" variant="danger">
                Cancel
              </Btn>
            </>
          ) : null}
        </div>

        {open ? <LinkBox lead={lead} proforma={proforma} /> : null}

        {proforma.payments.filter((payment) => payment.status !== "CREATED").length ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Payments</p>
            <ul className="space-y-1.5">
              {proforma.payments
                .filter((payment) => payment.status !== "CREATED")
                .map((payment) => (
                  <li className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs" key={payment.id}>
                    <div className="min-w-0">
                      <Badge tone={PAYMENT_STATUS[payment.status].tone}>{PAYMENT_STATUS[payment.status].label}</Badge>
                      <span className="ml-2 text-slate-500">
                        {payment.method ?? "—"} · {fmtDateTime(payment.capturedAt ?? payment.createdAt)}
                      </span>
                      {payment.failureReason ? <p className="mt-0.5 truncate text-red-700">{payment.failureReason}</p> : null}
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{money(payment.amountMinor, proforma.currency)}</span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </div>

      <ConfirmModal
        busy={isPending("cancel")}
        confirmLabel="Cancel proforma"
        danger
        message={`${proforma.number} is withdrawn and its payment link stops working.`}
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => {
          const done = await run(
            "cancel",
            async () => {
              await crmFetch(`/proformas/${proforma.id}/cancel`, { method: "POST" });
              refreshLead(lead.id);
              return true;
            },
            `${proforma.number} cancelled.`
          );
          if (done) setConfirmCancel(false);
        }}
        open={confirmCancel}
        title="Cancel this proforma?"
      />
    </Card>
  );
}

function LinkBox({ lead, proforma }: { lead: LeadDetail; proforma: Proforma }) {
  const { run, isPending } = useAction();
  const link: PaymentLink | undefined = proforma.paymentLinks.find((entry) => entry.status === "ACTIVE");

  if (!link) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm">
        <p className="text-slate-600">No payment link yet.</p>
        <Btn
          className="mt-2"
          loading={isPending("link")}
          onClick={() =>
            void run(
              "link",
              async () => {
                await crmFetch(`/proformas/${proforma.id}/payment-links`, { method: "POST", body: "{}" });
                refreshLead(lead.id);
              },
              "Payment link created — share it with the principal."
            )
          }
          variant="primary"
        >
          Create payment link
        </Btn>
      </div>
    );
  }

  const expired = new Date(link.expiresAt).getTime() < Date.now();

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Payment link</p>
        <span className="text-xs text-slate-500">
          {expired ? "Expired" : link.firstViewedAt ? `Opened ${timeAgo(link.firstViewedAt)}` : "Not opened yet"}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-slate-600" title={link.url}>
        {link.url}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">Valid until {fmtDate(link.expiresAt)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          className="inline-flex h-8 items-center rounded-md bg-green-600 px-2.5 text-xs font-semibold text-white hover:bg-green-700"
          href={whatsappUrl(lead.phone, link.shareText ?? link.url)}
          onClick={() => {
            void crmFetch(`/payment-links/${link.id}/shared`, { method: "POST" }).then(() => refreshLead(lead.id));
          }}
          rel="noreferrer"
          target="_blank"
        >
          Share on WhatsApp
        </a>
        <CopyButton label="Copy message" text={link.shareText ?? link.url} />
        <Btn
          loading={isPending("revoke")}
          onClick={() =>
            void run(
              "revoke",
              async () => {
                await crmFetch(`/payment-links/${link.id}/revoke`, { method: "POST" });
                refreshLead(lead.id);
              },
              "Payment link revoked."
            )
          }
          size="sm"
          variant="ghost"
        >
          Revoke
        </Btn>
        {expired ? (
          <Btn
            loading={isPending("link")}
            onClick={() =>
              void run(
                "link",
                async () => {
                  await crmFetch(`/proformas/${proforma.id}/payment-links`, { method: "POST", body: "{}" });
                  refreshLead(lead.id);
                },
                "New payment link created."
              )
            }
            size="sm"
            variant="primary"
          >
            New link
          </Btn>
        ) : null}
      </div>
    </div>
  );
}

function SchoolCard({ lead }: { lead: LeadDetail }) {
  const { run, isPending } = useAction();
  const [sharing, setSharing] = useState(false);
  const status = ONBOARDING[lead.onboardingStatus];

  return (
    <Card>
      <CardHeader actions={<Badge tone={status.tone}>{status.label}</Badge>} title="School" />
      <div className="space-y-3 p-4 text-sm">
        <div>
          <p className="text-xs text-slate-500">School ID</p>
          <p className="text-lg font-bold tracking-wide text-slate-900">{lead.schoolId}</p>
          {lead.paidAt ? <p className="text-xs text-slate-500">Paid {fmtDateTime(lead.paidAt)}</p> : null}
        </div>

        {lead.onboardingStatus === "RUNNING" || lead.onboardingStatus === "NOT_STARTED" ? (
          <p className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-blue-800">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Creating the school database and principal login…
          </p>
        ) : null}

        {lead.onboardingStatus === "FAILED" ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-red-800">
            <p className="font-semibold">Setup did not finish. The payment is safe.</p>
            {lead.onboardingError ? <p className="mt-1 break-words text-xs">{lead.onboardingError}</p> : null}
            <Btn
              className="mt-2"
              loading={isPending("retry")}
              onClick={() =>
                void run(
                  "retry",
                  async () => {
                    await crmFetch(`/leads/${lead.id}/onboarding/retry`, { method: "POST" });
                    refreshLead(lead.id);
                  },
                  "Setup restarted."
                )
              }
              size="sm"
              variant="primary"
            >
              Retry setup
            </Btn>
          </div>
        ) : null}

        {lead.onboardingStatus === "DONE" ? (
          <>
            {lead.school?.subscription ? (
              <p className="text-slate-600">Subscription active until {fmtDate(lead.school.subscription.currentPeriodEnd)}.</p>
            ) : null}
            <Btn onClick={() => setSharing(true)} variant="primary">
              Share login details
            </Btn>
          </>
        ) : null}
      </div>
      {sharing ? <LoginDetailsModal lead={lead} onClose={() => setSharing(false)} /> : null}
    </Card>
  );
}

type LoginDetails = { phone: string; loginUrl: string; identifier: string; password: string; message: string };

function LoginDetailsModal({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const { run, isPending } = useAction();
  const [details, setDetails] = useState<LoginDetails | null>(null);

  if (!details) {
    return (
      <ConfirmModal
        busy={isPending("login")}
        confirmLabel="Generate login details"
        message={`This sets a new temporary password for ${lead.email}. Any password sent before stops working.`}
        onClose={onClose}
        onConfirm={async () => {
          const result = await run("login", async () => {
            const issued = await crmFetch<LoginDetails>(`/leads/${lead.id}/login-details`, { method: "POST" });
            refreshLead(lead.id);
            return issued;
          });
          if (result) setDetails(result);
        }}
        open
        title="Share login details"
      />
    );
  }

  return (
    <FormModal
      description="Send this to the principal now — the password is not stored and cannot be shown again."
      onClose={onClose}
      onSubmit={onClose}
      open
      submitLabel="Done"
      title="Login details"
    >
      <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-800">{details.message}</pre>
      <div className="flex flex-wrap gap-2">
        <a
          className="inline-flex h-8 items-center rounded-md bg-green-600 px-2.5 text-xs font-semibold text-white hover:bg-green-700"
          href={whatsappUrl(details.phone, details.message)}
          rel="noreferrer"
          target="_blank"
        >
          Send on WhatsApp
        </a>
        <CopyButton label="Copy message" text={details.message} />
      </div>
    </FormModal>
  );
}

function IssueProformaModal({ lead, revising, onClose }: { lead: LeadDetail; revising: boolean; onClose: () => void }) {
  const plans = useResource<Plan[]>("/plans");
  const { run, isPending } = useAction();
  const [planCode, setPlanCode] = useState("");
  const [price, setPrice] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [validDays, setValidDays] = useState("15");
  const [notes, setNotes] = useState("");

  const plan = plans.data?.find((entry) => entry.code === planCode) ?? null;
  const priceRupees = Number(price);
  const valid = Boolean(plan) && (price === "" || priceRupees > 0) && Number(validDays) >= 1;

  return (
    <FormModal
      description={
        revising ? "The open proforma is cancelled and its payment link stops working." : "Prices are before GST; GST is added on the proforma."
      }
      onClose={onClose}
      onSubmit={async () => {
        const done = await run(
          "issue",
          async () => {
            await crmFetch(`/leads/${lead.id}/proformas`, {
              method: "POST",
              body: JSON.stringify({
                planCode,
                ...(price !== "" && plan && Math.round(priceRupees * 100) !== plan.priceMinor ? { priceRupees } : {}),
                ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
                validDays: Number(validDays),
                ...(notes.trim() ? { notes: notes.trim() } : {})
              })
            });
            refreshLead(lead.id);
            return true;
          },
          "Proforma issued."
        );
        if (done) onClose();
      }}
      open
      submitDisabled={!valid}
      submitLabel={revising ? "Issue revised proforma" : "Issue proforma"}
      submitting={isPending("issue")}
      title={revising ? "Revise proforma" : "Issue proforma"}
    >
      <Field label="Plan">
        <Select
          ariaLabel="Plan"
          onChange={(code) => {
            setPlanCode(code);
            const picked = plans.data?.find((entry) => entry.code === code);
            setPrice(picked ? String(picked.priceMinor / 100) : "");
          }}
          options={[
            { value: "", label: plans.isLoading ? "Loading plans…" : "Choose a plan" },
            ...(plans.data ?? []).map((entry) => ({ value: entry.code, label: `${entry.name} — ${money(entry.priceMinor, entry.currency)} ${intervalLabel(entry)}` }))
          ]}
          value={planCode}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field hint={plan ? `List price ${money(plan.priceMinor, plan.currency)}` : undefined} label="Agreed price (₹, before GST)">
          <Input disabled={!plan} inputMode="decimal" min={1} onChange={(event) => setPrice(event.target.value)} step="0.01" type="number" value={price} />
        </Field>
        <Field label="Coupon (optional)">
          <Input onChange={(event) => setCouponCode(event.target.value.toUpperCase())} value={couponCode} />
        </Field>
        <Field label="Valid for (days)">
          <Input inputMode="numeric" max={90} min={1} onChange={(event) => setValidDays(event.target.value)} type="number" value={validDays} />
        </Field>
      </div>
      <Field label="Note on the proforma (optional)">
        <TextArea maxLength={500} onChange={(event) => setNotes(event.target.value)} value={notes} />
      </Field>
      <p className={cx("text-xs text-slate-500", !plan && "invisible")}>
        Billed to {lead.schoolName}
        {lead.gstin ? ` (GSTIN ${lead.gstin})` : " (unregistered)"}
        {lead.stateName ? `, ${lead.stateName}` : ", state not set — set it so the right GST split is printed"}.
      </p>
    </FormModal>
  );
}
