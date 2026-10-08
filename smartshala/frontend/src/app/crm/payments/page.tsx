"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SideModal } from "@/components/ui";
import { Badge, Btn, DataTable, ErrorBanner, Input, PageHeader, cx, type Column } from "../../super-admin/_components/ui";
import { useAction } from "../../super-admin/_lib/action";
import { fmtDate, money } from "../../super-admin/_lib/format";
import { crmDownload } from "../crmFetch";
import { ONBOARDING, PAYMENT_STATUS, compactRupees } from "../_lib/format";
import { useResource } from "../_lib/resource";
import { useCrmUser } from "../_lib/session";
import type { CrmPayment, PaymentsPage as PaymentsData } from "../_lib/types";

type Period = "month" | "last-month" | "fy" | "all";

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "fy", label: "This financial year" },
  { id: "all", label: "All time" }
];

/** Midnight-aligned, so the same period always yields the same request (and cache key). */
function rangeFor(period: Period) {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  switch (period) {
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    case "last-month":
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "fy": {
      const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      return { from: new Date(startYear, 3, 1), to: new Date(startYear + 1, 3, 1) };
    }
    case "all":
      return { from: new Date(2020, 0, 1), to: tomorrow };
  }
}

function fmtTime(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const paidAt = (payment: CrmPayment) => payment.capturedAt ?? payment.createdAt;

export default function PaymentsPage() {
  const user = useCrmUser();
  const [period, setPeriod] = useState<Period>("month");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<CrmPayment | null>(null);

  const key = useMemo(() => {
    const { from, to } = rangeFor(period);
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    if (query) params.set("q", query);
    return `/payments?${params}`;
  }, [period, query]);
  const page = useResource<PaymentsData>(key);
  const summary = page.data?.summary;

  const columns: Array<Column<CrmPayment>> = [
    {
      key: "lead",
      header: "Lead info",
      cell: (payment) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              className="truncate font-semibold text-slate-900 hover:text-blue-700"
              href={`/crm/leads/${payment.lead.id}`}
              onClick={(event) => event.stopPropagation()}
            >
              {payment.lead.schoolName} ↗
            </Link>
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">{payment.lead.code}</span>
          </div>
          <p className="truncate text-xs text-slate-500">{payment.lead.schoolId ? `School ${payment.lead.schoolId}` : "—"}</p>
        </div>
      )
    },
    {
      key: "owner",
      header: "Lead owner",
      cell: (payment) => <span className="text-sm">{payment.lead.assignedTo?.name ?? "Unassigned"}</span>
    },
    {
      key: "amount",
      header: "Amount / Type",
      cell: (payment) => (
        <div>
          <p className="font-semibold tabular-nums text-slate-900">{money(payment.amountMinor, payment.currency)}</p>
          <p className="text-xs capitalize text-slate-500">{payment.method ?? "—"}</p>
        </div>
      )
    },
    {
      key: "status",
      header: "Status",
      cell: (payment) => <Badge tone={PAYMENT_STATUS[payment.status].tone}>{PAYMENT_STATUS[payment.status].label}</Badge>
    },
    {
      key: "date",
      header: "Payment date",
      cell: (payment) => (
        <div className="text-sm">
          <p className="font-medium text-slate-800">{fmtDate(paidAt(payment))}</p>
          <p className="text-xs text-slate-500">{fmtTime(paidAt(payment))}</p>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((entry) => (
              <button
                className={cx(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  period === entry.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
                key={entry.id}
                onClick={() => setPeriod(entry.id)}
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
        }
        description={user.role === "ADMIN" ? "What new schools paid on their proformas." : "What your leads paid on their proformas."}
        title="Payments"
      />

      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Total revenue</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{summary ? compactRupees(summary.collectedMinor) : "—"}</p>
            <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {summary ? `${summary.paymentsCount} payment${summary.paymentsCount === 1 ? "" : "s"}` : "…"}
            </span>
          </div>
          <div className="hidden h-12 w-px bg-slate-200 sm:block" />
          <p className="text-sm text-slate-500">
            {summary ? `${money(summary.collectedMinor)} collected, after refunds.` : "Loading…"}
          </p>
        </div>
        <div className="rounded-lg border border-red-100 bg-red-50 px-5 py-4">
          <p className="text-xs font-medium text-red-700">Revenue lost</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-red-700">{summary ? compactRupees(summary.lostMinor) : "—"}</p>
          <p className="mt-1 text-xs text-red-700/80">{summary ? `${summary.lostLeads} lead${summary.lostLeads === 1 ? "" : "s"} marked lost` : ""}</p>
        </div>
      </div>

      <form
        className="mb-3 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(text.trim());
        }}
      >
        <Input
          aria-label="Search payments"
          className="max-w-xs"
          onChange={(event) => setText(event.target.value)}
          placeholder="Search by school, principal, phone, school ID"
          value={text}
        />
        <Btn type="submit">Search</Btn>
      </form>

      {page.error ? <ErrorBanner message={page.error} onRetry={() => void page.reload()} /> : null}
      <DataTable
        columns={columns}
        empty="No payments in this period."
        loading={page.isLoading}
        minWidth={820}
        onRowClick={setOpen}
        rowKey={(payment) => payment.id}
        rows={page.data?.payments}
      />

      {open ? <PaymentDrawer onClose={() => setOpen(null)} payment={open} /> : null}
    </>
  );
}

function Line({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cx("min-w-0 break-words text-right", strong ? "font-semibold text-slate-900" : "font-medium text-slate-800")}>{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
        {title}
        <span className="h-px flex-1 bg-slate-200" />
      </h3>
      <dl>{children}</dl>
    </section>
  );
}

function PaymentDrawer({ payment, onClose }: { payment: CrmPayment; onClose: () => void }) {
  const { run, isPending } = useAction();
  const { lead, proforma } = payment;
  const offPercent = proforma.listPriceMinor > proforma.subtotalMinor ? Math.round((1 - proforma.subtotalMinor / proforma.listPriceMinor) * 100) : 0;
  const status = PAYMENT_STATUS[payment.status];

  return (
    <SideModal eyebrow={lead.code} onClose={onClose} title="Payment details">
      <div className="space-y-5">
        <Section title="Order details">
          <Line label="School">{lead.schoolName}</Line>
          <Line label="Lead ID">{lead.code}</Line>
          <Line label="Principal">{lead.ownerName}</Line>
          <Line label="Mobile">{lead.phone}</Line>
          <Line label="Email">{lead.email}</Line>
          <Line label="GSTIN">{lead.gstin ?? "Unregistered"}</Line>
          <Line label="School ID">{lead.schoolId ?? "—"}</Line>
          <Line label="Activation">
            <span className={lead.onboardingStatus === "DONE" ? "text-green-700" : undefined}>{ONBOARDING[lead.onboardingStatus].label}</span>
          </Line>
        </Section>

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-900">Product breakdown (1)</p>
          <div className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0 text-slate-800">{proforma.planName} ×1</span>
            <span className="flex shrink-0 items-center gap-2">
              {offPercent > 0 ? <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-bold text-green-700">{offPercent}% off</span> : null}
              <span className="font-semibold tabular-nums">{money(proforma.subtotalMinor)}</span>
              {offPercent > 0 ? <span className="text-xs tabular-nums text-slate-400 line-through">{money(proforma.listPriceMinor)}</span> : null}
            </span>
          </div>
          <dl className="mt-2 border-t border-slate-100 pt-1">
            {proforma.discountMinor > 0 ? <Line label={`Coupon ${proforma.couponCode ?? ""}`}>−{money(proforma.discountMinor)}</Line> : null}
            <Line label="Total after discount">{money(proforma.subtotalMinor - proforma.discountMinor)}</Line>
            <Line label="Tax">{money(proforma.taxMinor)}</Line>
            <Line label="Payable amount" strong>
              {money(proforma.totalMinor)}
            </Line>
          </dl>
        </div>

        <Section title="Payment details">
          <Line label="Date & time">
            {fmtDate(paidAt(payment))}, {fmtTime(paidAt(payment))}
          </Line>
          <Line label="Paid amount">{money(payment.amountMinor, payment.currency)}</Line>
          {payment.refundedMinor > 0 ? <Line label="Refunded">{money(payment.refundedMinor, payment.currency)}</Line> : null}
          <Line label="Created by">{proforma.createdBy}</Line>
          <Line label="Lead owner">{lead.assignedTo?.name ?? "Unassigned"}</Line>
          <Line label="Payment type">
            <span className="capitalize">{payment.method ?? "—"}</span>
          </Line>
          <Line label="Status">
            <Badge tone={status.tone}>{status.label}</Badge>
          </Line>
          {payment.failureReason ? <Line label="Reason">{payment.failureReason}</Line> : null}
          <Line label="Proforma">{proforma.number}</Line>
          <Line label="Tax invoice">{payment.invoice?.number ?? (payment.status === "CAPTURED" ? "Issued when the school is set up" : "—")}</Line>
          <Line label="Gateway reference">{payment.providerPaymentId ?? payment.providerOrderId ?? "—"}</Line>
          {payment.gatewayMode === "MOCK" ? <Line label="Mode">Test (no real money)</Line> : null}
        </Section>

        <div className="flex flex-wrap gap-2">
          <Btn
            loading={isPending("proforma")}
            onClick={() => void run("proforma", () => crmDownload(`/proformas/${proforma.id}/pdf`, `proforma-${proforma.number}.pdf`))}
            size="sm"
          >
            Proforma PDF
          </Btn>
          {payment.invoice ? (
            <Btn
              loading={isPending("invoice")}
              onClick={() => void run("invoice", () => crmDownload(`/invoices/${payment.invoice!.id}/pdf`, `invoice-${payment.invoice!.number}.pdf`))}
              size="sm"
              variant="primary"
            >
              Tax invoice PDF
            </Btn>
          ) : null}
        </div>
      </div>
    </SideModal>
  );
}
