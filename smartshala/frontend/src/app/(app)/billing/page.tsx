"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal, PageHeader } from "@/components/ui";
import {
  billingApi,
  formatMinor,
  type BillingOverview,
  type CheckoutSession,
  type Invoice,
  type Plan,
  type SubscriptionStatus
} from "@/lib/api";
import { CheckoutModal } from "./CheckoutModal";

const cardClass = "rounded-[6px] border border-[#C9D3DE] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6";

const STATUS_STYLES: Record<SubscriptionStatus, { label: string; className: string }> = {
  TRIALING: { label: "Trial", className: "bg-[#EEF3FF] text-[#2456E6]" },
  ACTIVE: { label: "Active", className: "bg-[#E1F5EA] text-[#0F8A4A]" },
  PAST_DUE: { label: "Payment due", className: "bg-[#FFF4E5] text-[#8A5300]" },
  CANCELLED: { label: "Cancelled", className: "bg-[#F1F3F6] text-[#5A6573]" },
  EXPIRED: { label: "Expired", className: "bg-[#FCE3E5] text-[#C8242C]" }
};

const INVOICE_STYLES: Record<Invoice["status"], string> = {
  DRAFT: "bg-[#F1F3F6] text-[#5A6573]",
  DUE: "bg-[#FFF4E5] text-[#8A5300]",
  PAID: "bg-[#E1F5EA] text-[#0F8A4A]",
  VOID: "bg-[#F1F3F6] text-[#5A6573]",
  REFUNDED: "bg-[#EEF3FF] text-[#2456E6]"
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function intervalLabel(plan: Plan) {
  const unit = plan.interval === "MONTH" ? "month" : "year";
  return plan.intervalCount === 1 ? `per ${unit}` : `per ${plan.intervalCount} ${unit}s`;
}

export default function BillingPage() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [openInvoice, setOpenInvoice] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setOverview(await billingApi.overview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your subscription");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const status = overview ? STATUS_STYLES[overview.subscription.status] : null;

  async function downloadInvoice(invoice: Invoice) {
    setBusy(`pdf-${invoice.id}`);
    setError("");
    try {
      await billingApi.downloadInvoicePdf(invoice.id, invoice.number);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download that invoice");
    } finally {
      setBusy("");
    }
  }

  async function startCheckout(planCode: string) {
    setBusy(planCode);
    setError("");
    setNotice("");
    try {
      setSession(await billingApi.checkout(planCode, null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout");
    } finally {
      setBusy("");
    }
  }

  async function toggleAutoRenew() {
    if (!overview) return;
    setBusy("auto-renew");
    setError("");
    try {
      await billingApi.setAutoRenew(overview.subscription.cancelAtPeriodEnd);
      await load();
      setNotice(overview.subscription.cancelAtPeriodEnd ? "Auto-renewal turned on." : "Auto-renewal turned off.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update auto-renewal");
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader hideBreadcrumbs title="Billing" />
        <div className={cardClass}>
          <p className="text-[13px] font-semibold text-[#5A6573]">Loading your subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader hideBreadcrumbs title="Billing" />

      {error ? <div className="rounded-[6px] border border-[#FCE3E5] bg-[#FCE3E5] p-4 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}
      {notice ? <div className="rounded-[6px] border border-[#D6F0DF] bg-[#E1F5EA] p-4 text-[13px] font-semibold text-[#0F8A4A]">{notice}</div> : null}

      {overview ? (
        <>
          {overview.subscription.status === "PAST_DUE" || overview.subscription.status === "EXPIRED" ? (
            <div className="rounded-[6px] border border-[#F2B8B5] bg-[#FFF8F8] p-4">
              <p className="text-[15px] font-semibold text-[#C8242C]">
                {overview.subscription.status === "EXPIRED"
                  ? "Your subscription has expired and the school is suspended."
                  : "Your subscription term has ended."}
              </p>
              <p className="mt-1 text-[13px] font-medium text-[#5A6573]">
                {overview.subscription.gracePeriodEndsAt
                  ? `Staff keep access until ${formatDate(overview.subscription.gracePeriodEndsAt)}. Pay the open invoice to restore full service.`
                  : "Pay the open invoice below to restore access for your staff."}
              </p>
            </div>
          ) : null}

          {overview.subscription.cancelAtPeriodEnd ? (
            <div className="rounded-[6px] border border-[#FDE3B8] bg-[#FFF8EC] p-4 text-[13px] font-semibold text-[#8A5300]">
              Auto-renewal is off. Access ends on {formatDate(overview.subscription.currentPeriodEnd)}.
            </div>
          ) : null}

          {/* Current plan ------------------------------------------------ */}
          <section className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#5A6573]">Current plan</p>
                <h2 className="mt-1 text-[24px] font-semibold text-[#031526]">{overview.plan.name}</h2>
                <p className="mt-1 text-[13px] font-medium text-[#5A6573]">
                  {overview.pricing.effectivePriceMinor === 0
                    ? "No charge"
                    : `${formatMinor(overview.pricing.effectivePriceMinor, overview.plan.currency)} ${intervalLabel(overview.plan)}`}
                  {overview.subscription.couponCode ? ` · Coupon ${overview.subscription.couponCode}` : ""}
                </p>
                {overview.pricing.isCustomPrice ? (
                  <p className="mt-1 text-[12px] font-semibold text-[#0F8A4A]">
                    Agreed rate for your school — standard price is{" "}
                    {formatMinor(overview.pricing.listPriceMinor, overview.plan.currency)}.
                  </p>
                ) : null}
              </div>
              {status ? (
                <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${status.className}`}>{status.label}</span>
              ) : null}
            </div>

            <dl className="mt-5 grid gap-4 border-t border-[#EDF0F4] pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-[12px] font-semibold text-[#5A6573]">Term started</dt>
                <dd className="mt-0.5 text-[14px] font-semibold text-[#031526]">{formatDate(overview.subscription.currentPeriodStart)}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[#5A6573]">
                  {overview.subscription.cancelAtPeriodEnd ? "Access ends" : "Renews on"}
                </dt>
                <dd className="mt-0.5 text-[14px] font-semibold text-[#031526]">{formatDate(overview.subscription.currentPeriodEnd)}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[#5A6573]">Days remaining</dt>
                <dd className={`mt-0.5 text-[14px] font-semibold ${overview.subscription.daysRemaining <= 7 ? "text-[#C8242C]" : "text-[#031526]"}`}>
                  {overview.subscription.daysRemaining}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#EDF0F4] pt-4">
              <button
                className="min-h-10 rounded-[6px] border border-[#C2C9D4] bg-white px-4 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB] disabled:opacity-50"
                disabled={busy === "auto-renew" || overview.plan.priceMinor === 0}
                onClick={toggleAutoRenew}
                type="button"
              >
                {overview.subscription.cancelAtPeriodEnd ? "Turn auto-renewal on" : "Turn auto-renewal off"}
              </button>
              <span className="text-[12px] font-medium text-[#5A6573]">
                Lifetime paid: {formatMinor(overview.totals.paidMinor, overview.totals.currency)}
              </span>
            </div>
          </section>

          {/* Open invoice --------------------------------------------------- */}
          {overview.openInvoice ? (
            <section className="rounded-[6px] border border-[#FDE3B8] bg-[#FFF8EC] p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[15px] font-semibold text-[#031526]">
                    Invoice {overview.openInvoice.number} is due
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-[#5A6573]">
                    {overview.openInvoice.planName} · {formatDate(overview.openInvoice.periodStart)} — {formatDate(overview.openInvoice.periodEnd)} · due{" "}
                    {formatDate(overview.openInvoice.dueAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[20px] font-bold text-[#031526]">
                    {formatMinor(overview.openInvoice.totalMinor - overview.openInvoice.amountPaidMinor, overview.openInvoice.currency)}
                  </span>
                  <button
                    className="min-h-11 rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD] disabled:opacity-50"
                    disabled={busy === overview.openInvoice.planCode}
                    onClick={() => startCheckout(overview.openInvoice!.planCode)}
                    type="button"
                  >
                    Pay now
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {/* Billing history ------------------------------------------------- */}
          <section className="rounded-[6px] border border-[#C9D3DE] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
            <div className="border-b border-[#EDF0F4] p-4 sm:p-6">
              <h2 className="text-[17px] font-semibold text-[#031526]">Billing history</h2>
              <p className="mt-1 text-[13px] font-medium text-[#5A6573]">Every invoice raised on this school.</p>
            </div>
            {overview.invoices.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-[13px]">
                  <thead className="table-head text-left text-[11px] uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Issued</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.invoices.map((invoice) => (
                      <tr
                        className="cursor-pointer border-t border-[#EDF0F4] hover:bg-[#F7F8FB]"
                        key={invoice.id}
                        onClick={() => setOpenInvoice(invoice)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#031526]">{invoice.number}</p>
                          {invoice.payments.find((payment) => payment.status === "CAPTURED")?.providerPaymentId ? (
                            <p className="text-[11px] text-[#5A6573]">
                              {invoice.payments.find((payment) => payment.status === "CAPTURED")!.providerPaymentId}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-[#2A3340]">{invoice.planName}</td>
                        <td className="px-4 py-3 text-[#5A6573]">
                          {formatDate(invoice.periodStart)} — {formatDate(invoice.periodEnd)}
                        </td>
                        <td className="px-4 py-3 text-[#5A6573]">{formatDate(invoice.issuedAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${INVOICE_STYLES[invoice.status]}`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#031526]">
                          {formatMinor(invoice.totalMinor, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-4 text-[13px] font-semibold text-[#5A6573] sm:p-6">No invoices yet.</p>
            )}
          </section>
        </>
      ) : null}

      <Modal
        description={openInvoice ? `${openInvoice.planName} · ${formatDate(openInvoice.periodStart)} — ${formatDate(openInvoice.periodEnd)}` : ""}
        isOpen={Boolean(openInvoice)}
        onClose={() => setOpenInvoice(null)}
        title={openInvoice ? `Invoice ${openInvoice.number}` : ""}
      >
        {openInvoice ? (
          <div className="space-y-5 p-5">
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${INVOICE_STYLES[openInvoice.status]}`}>
                {openInvoice.status}
              </span>
              <span className="text-[12px] font-medium text-[#5A6573]">
                Issued {formatDate(openInvoice.issuedAt)} · Due {formatDate(openInvoice.dueAt)}
              </span>
            </div>

            <div className="space-y-2 rounded-[6px] border border-[#C9D3DE] bg-[#F7F8FB] p-4 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#5A6573]">Subtotal</span>
                <span className="font-semibold text-[#031526]">{formatMinor(openInvoice.subtotalMinor, openInvoice.currency)}</span>
              </div>
              {openInvoice.discountMinor > 0 ? (
                <div className="flex justify-between">
                  <span className="text-[#5A6573]">Discount{openInvoice.couponCode ? ` (${openInvoice.couponCode})` : ""}</span>
                  <span className="font-semibold text-[#0F8A4A]">−{formatMinor(openInvoice.discountMinor, openInvoice.currency)}</span>
                </div>
              ) : null}
              {openInvoice.taxMinor > 0 ? (
                <div className="flex justify-between">
                  <span className="text-[#5A6573]">GST</span>
                  <span className="font-semibold text-[#031526]">{formatMinor(openInvoice.taxMinor, openInvoice.currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-[#DCE1E8] pt-2 text-[15px]">
                <span className="font-semibold text-[#031526]">Total</span>
                <span className="font-bold text-[#031526]">{formatMinor(openInvoice.totalMinor, openInvoice.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5A6573]">Paid</span>
                <span className="font-semibold text-[#031526]">{formatMinor(openInvoice.amountPaidMinor, openInvoice.currency)}</span>
              </div>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-[#031526]">Payments</p>
              {openInvoice.payments.length ? (
                <ul className="mt-2 space-y-2">
                  {openInvoice.payments.map((payment) => (
                    <li className="rounded-[6px] border border-[#DCE1E8] px-3 py-2 text-[12px]" key={payment.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#031526]">
                          {formatMinor(payment.amountMinor, payment.currency)} · {payment.status}
                        </span>
                        <span className="text-[#5A6573]">{formatDate(payment.capturedAt ?? payment.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-[#5A6573]">
                        {payment.method ? `${payment.method} · ` : ""}
                        {payment.providerPaymentId ?? payment.providerOrderId ?? "—"}
                        {payment.refundedMinor > 0 ? ` · refunded ${formatMinor(payment.refundedMinor, payment.currency)}` : ""}
                      </p>
                      {payment.failureReason ? <p className="mt-0.5 text-[#C8242C]">{payment.failureReason}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[12px] text-[#5A6573]">No payment attempts recorded yet.</p>
              )}
            </div>

            <button
              className="min-h-11 w-full rounded-[6px] border border-[#C9D3DE] bg-white px-5 text-[14px] font-semibold text-[#031526] hover:bg-[#F7F8FB] disabled:opacity-50"
              disabled={busy === `pdf-${openInvoice.id}`}
              onClick={() => void downloadInvoice(openInvoice)}
              type="button"
            >
              {busy === `pdf-${openInvoice.id}` ? "Preparing…" : "Download invoice (PDF)"}
            </button>

            {openInvoice.status === "DUE" ? (
              <button
                className="min-h-11 w-full rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD] disabled:opacity-50"
                disabled={busy === openInvoice.planCode}
                onClick={() => {
                  const planCode = openInvoice.planCode;
                  setOpenInvoice(null);
                  void startCheckout(planCode);
                }}
                type="button"
              >
                Pay this invoice
              </button>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <CheckoutModal
        onClose={() => setSession(null)}
        onPaid={async (invoiceNumber) => {
          setSession(null);
          setNotice(`Payment received. Invoice ${invoiceNumber} is settled.`);
          await load();
        }}
        session={session}
      />
    </div>
  );
}
