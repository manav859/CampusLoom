"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";
import { useAction } from "../_lib/action";
import { fmtDate, money } from "../_lib/format";
import { invalidate } from "../_lib/resource";
import { OFFLINE_METHODS, type Invoice, type OfflineMethod, type PaymentLinkRow } from "../_lib/types";
import { superAdminDownload, superAdminFetch } from "../superAdminFetch";
import { Btn, Callout, CopyButton, Field, FormModal, Input, RowActions, Select, TextArea } from "./ui";

/** Everything a billing change can touch, refreshed in one call. */
export function invalidateBilling(schoolId?: string) {
  invalidate(
    "/billing/summary",
    "/billing/invoices",
    "/billing/payment-links",
    "/billing/renewals",
    "/billing/subscriptions",
    "/schools",
    ...(schoolId ? [`/billing/schools/${schoolId}`] : [])
  );
}

const METHOD_LABELS: Record<OfflineMethod, string> = {
  neft: "Bank transfer (NEFT / RTGS / IMPS)",
  upi: "UPI",
  cheque: "Cheque",
  cash: "Cash",
  card: "Card",
  other: "Other"
};

export const OFFLINE_METHOD_OPTIONS = OFFLINE_METHODS.map((value) => ({ value, label: METHOD_LABELS[value] }));

const linkButton =
  "inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50";

export function whatsappShareUrl(link: Pick<PaymentLinkRow, "url" | "amountMinor" | "currency">, schoolName: string) {
  const text = `Hello ${schoolName}, please use this secure link to pay your SmartShala subscription of ${money(link.amountMinor, link.currency)}: ${link.url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** The fields every invoice action needs — satisfied by a full invoice or a renewal row's open invoice. */
export type InvoiceLike = Pick<Invoice, "id" | "number" | "schoolId" | "status" | "totalMinor" | "amountPaidMinor" | "currency"> & {
  payments?: Invoice["payments"];
};

type ModalKind = "link" | "paid" | "void" | "refund";

/** The action buttons for one invoice row, and the modals they open. */
export function InvoiceActions({ invoice, schoolName }: { invoice: InvoiceLike; schoolName: string }) {
  const { run, isPending } = useAction();
  const [modal, setModal] = useState<ModalKind | null>(null);
  const refundable = invoice.payments?.find((payment) => payment.status === "CAPTURED" && payment.refundedMinor < payment.amountMinor);
  const due = invoice.status === "DUE";

  return (
    <RowActions>
      <Btn
        loading={isPending("pdf")}
        onClick={() => void run("pdf", () => superAdminDownload(`/billing/invoices/${invoice.id}/pdf`, `invoice-${invoice.number}.pdf`))}
        size="sm"
      >
        PDF
      </Btn>
      {due ? (
        <>
          <Btn onClick={() => setModal("link")} size="sm" variant="primary">
            Send link
          </Btn>
          <Btn onClick={() => setModal("paid")} size="sm">
            Mark paid
          </Btn>
          <Btn onClick={() => setModal("void")} size="sm" variant="danger">
            Void
          </Btn>
        </>
      ) : null}
      {refundable ? (
        <Btn onClick={() => setModal("refund")} size="sm" variant="danger">
          Refund
        </Btn>
      ) : null}

      {modal === "link" ? <PaymentLinkModal invoice={invoice} onClose={() => setModal(null)} schoolName={schoolName} /> : null}
      {modal === "paid" ? <MarkPaidModal invoice={invoice} onClose={() => setModal(null)} /> : null}
      {modal === "void" ? <VoidInvoiceModal invoice={invoice} onClose={() => setModal(null)} /> : null}
      {modal === "refund" && refundable ? (
        <RefundModal
          invoice={invoice}
          onClose={() => setModal(null)}
          paymentId={refundable.id}
          refundableMinor={refundable.amountMinor - refundable.refundedMinor}
        />
      ) : null}
    </RowActions>
  );
}

export function PaymentLinkModal({ invoice, schoolName, onClose }: { invoice: InvoiceLike; schoolName: string; onClose: () => void }) {
  const { run, isPending } = useAction();
  const [days, setDays] = useState("14");
  const [note, setNote] = useState("");
  const [link, setLink] = useState<PaymentLinkRow | null>(null);

  if (link) return <LinkReadyModal link={link} onClose={onClose} schoolName={schoolName} />;

  return (
    <FormModal
      description={`${schoolName} · ${money(invoice.totalMinor - invoice.amountPaidMinor, invoice.currency)} due`}
      onClose={onClose}
      onSubmit={async () => {
        const created = await run("create-link", async () => {
          const result = await superAdminFetch<PaymentLinkRow>(`/billing/invoices/${invoice.id}/payment-links`, {
            method: "POST",
            body: JSON.stringify({ note: note.trim() || null, expiresInDays: Number(days) })
          });
          invalidateBilling(invoice.schoolId);
          return result;
        });
        if (created) setLink(created);
      }}
      open
      submitLabel="Create link"
      submitting={isPending("create-link")}
      title={`Payment link for ${invoice.number}`}
    >
      <Callout>Anyone with the link can pay this invoice through Razorpay — no login needed. An earlier link for this invoice stops working.</Callout>
      <Field label="Link stays valid for">
        <Select
          ariaLabel="Link validity"
          onChange={setDays}
          options={["7", "14", "30", "60"].map((value) => ({ value, label: `${value} days` }))}
          value={days}
        />
      </Field>
      <Field hint="Shown on the payment page." label="Message to the school (optional)">
        <TextArea maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Renewal for 2026–27" value={note} />
      </Field>
    </FormModal>
  );
}

export function LinkReadyModal({ link, schoolName, onClose }: { link: PaymentLinkRow; schoolName: string; onClose: () => void }) {
  return (
    <Modal
      description={`${money(link.amountMinor, link.currency)} · valid until ${fmtDate(link.expiresAt)}`}
      footer={
        <Btn onClick={onClose} variant="primary">
          Done
        </Btn>
      }
      isOpen
      onClose={onClose}
      title="Payment link ready"
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input onFocus={(event) => event.currentTarget.select()} readOnly value={link.url} />
          <CopyButton text={link.url} />
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={linkButton} href={whatsappShareUrl(link, schoolName)} rel="noreferrer" target="_blank">
            Share on WhatsApp
          </a>
          <a className={linkButton} href={link.url} rel="noreferrer" target="_blank">
            Open payment page
          </a>
        </div>
        <p className="text-xs text-slate-500">Their access renews automatically the moment they pay.</p>
      </div>
    </Modal>
  );
}

export function MarkPaidModal({ invoice, onClose }: { invoice: InvoiceLike; onClose: () => void }) {
  const { run, isPending } = useAction();
  const [method, setMethod] = useState<OfflineMethod>("neft");
  const [reference, setReference] = useState("");

  return (
    <FormModal
      description={`${money(invoice.totalMinor - invoice.amountPaidMinor, invoice.currency)} received outside Razorpay`}
      onClose={onClose}
      onSubmit={async () => {
        const done = await run(
          "mark-paid",
          async () => {
            await superAdminFetch(`/billing/invoices/${invoice.id}/mark-paid`, {
              method: "POST",
              body: JSON.stringify({ method, reference: reference.trim() || null })
            });
            invalidateBilling(invoice.schoolId);
            return true;
          },
          `${invoice.number} marked paid — the school's access is renewed.`
        );
        if (done) onClose();
      }}
      open
      submitLabel="Mark as paid"
      submitting={isPending("mark-paid")}
      title={`Record payment for ${invoice.number}`}
    >
      <Field label="How did they pay?">
        <Select ariaLabel="Payment method" onChange={setMethod} options={OFFLINE_METHOD_OPTIONS} value={method} />
      </Field>
      <Field hint="UTR, cheque number or receipt number — helps when reconciling." label="Reference (optional)">
        <Input maxLength={120} onChange={(event) => setReference(event.target.value)} value={reference} />
      </Field>
    </FormModal>
  );
}

function VoidInvoiceModal({ invoice, onClose }: { invoice: InvoiceLike; onClose: () => void }) {
  const { run, isPending } = useAction();
  const [reason, setReason] = useState("");

  return (
    <FormModal
      danger
      description="The school will no longer be asked to pay it. This cannot be undone."
      onClose={onClose}
      onSubmit={async () => {
        const done = await run(
          "void",
          async () => {
            await superAdminFetch(`/billing/invoices/${invoice.id}/void`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) });
            invalidateBilling(invoice.schoolId);
            return true;
          },
          `${invoice.number} voided.`
        );
        if (done) onClose();
      }}
      open
      submitDisabled={reason.trim().length < 3}
      submitLabel="Void invoice"
      submitting={isPending("void")}
      title={`Void ${invoice.number}?`}
    >
      <Field label="Reason">
        <Input autoFocus maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Raised for the wrong plan" value={reason} />
      </Field>
    </FormModal>
  );
}

function RefundModal({
  invoice,
  paymentId,
  refundableMinor,
  onClose
}: {
  invoice: InvoiceLike;
  paymentId: string;
  refundableMinor: number;
  onClose: () => void;
}) {
  const { run, isPending } = useAction();
  const [amount, setAmount] = useState(String(refundableMinor / 100));
  const [reason, setReason] = useState("");
  const rupees = Number(amount);
  const validAmount = Number.isFinite(rupees) && rupees >= 1 && rupees * 100 <= refundableMinor;

  return (
    <FormModal
      danger
      description={`Up to ${money(refundableMinor, invoice.currency)} can be refunded.`}
      onClose={onClose}
      onSubmit={async () => {
        const done = await run(
          "refund",
          async () => {
            await superAdminFetch(`/billing/payments/${paymentId}/refund`, {
              method: "POST",
              body: JSON.stringify({ reason: reason.trim(), amountRupees: rupees })
            });
            invalidateBilling(invoice.schoolId);
            return true;
          },
          "Refund processed."
        );
        if (done) onClose();
      }}
      open
      submitDisabled={!validAmount || reason.trim().length < 3}
      submitLabel="Refund"
      submitting={isPending("refund")}
      title={`Refund ${invoice.number}`}
    >
      <Field label="Amount (₹)">
        <Input min={1} onChange={(event) => setAmount(event.target.value)} step="0.01" type="number" value={amount} />
      </Field>
      <Field label="Reason">
        <Input maxLength={300} onChange={(event) => setReason(event.target.value)} value={reason} />
      </Field>
    </FormModal>
  );
}
