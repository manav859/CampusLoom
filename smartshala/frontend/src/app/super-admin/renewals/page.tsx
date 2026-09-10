"use client";

import { useMemo, useState } from "react";
import { SUBSCRIPTION_STATUS, daysLeftLabel, fmtDate, intervalLabel, money, timeAgo } from "../_lib/format";
import { useResource } from "../_lib/resource";
import type { RenewalRow } from "../_lib/types";
import { MarkPaidModal, PaymentLinkModal, type InvoiceLike } from "../_components/invoiceActions";
import { RenewModal } from "../_components/RenewModal";
import { SchoolBillingDrawer } from "../_components/SchoolBillingDrawer";
import { Badge, Btn, CopyButton, DataTable, ErrorBanner, Input, PageHeader, RowActions, Tabs, Toolbar, type Column } from "../_components/ui";

type Filter = "all" | "lapsed" | "week" | "month";

function isLapsed(row: RenewalRow) {
  return row.daysLeft < 0 || row.status === "PAST_DUE" || row.status === "EXPIRED";
}

function inFilter(row: RenewalRow, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "lapsed") return isLapsed(row);
  if (filter === "week") return !isLapsed(row) && row.daysLeft <= 7;
  return !isLapsed(row) && row.daysLeft > 7;
}

function asInvoice(row: RenewalRow): InvoiceLike | null {
  return row.openInvoice ? { ...row.openInvoice, schoolId: row.schoolId, status: "DUE" } : null;
}

type Dialog = { kind: "renew" | "link" | "paid"; row: RenewalRow };

/**
 * The renewal desk: every school whose term has run out or runs out within a
 * month, most urgent first, each with the one next step it needs.
 */
export default function RenewalsPage() {
  const renewals = useResource<RenewalRow[]>("/billing/renewals");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [drawerSchool, setDrawerSchool] = useState<string | null>(null);

  const counts = useMemo(() => {
    const data = renewals.data ?? [];
    return {
      all: data.length,
      lapsed: data.filter((row) => inFilter(row, "lapsed")).length,
      week: data.filter((row) => inFilter(row, "week")).length,
      month: data.filter((row) => inFilter(row, "month")).length
    };
  }, [renewals.data]);

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return renewals.data?.filter(
      (row) =>
        inFilter(row, filter) &&
        (!text || [row.school.schoolName, row.schoolId, row.school.ownerName, row.school.phone].some((value) => value.toLowerCase().includes(text)))
    );
  }, [filter, query, renewals.data]);

  const columns: Array<Column<RenewalRow>> = [
    {
      key: "school",
      header: "School",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.school.schoolName}</p>
          <p className="truncate text-xs text-slate-500">
            {row.schoolId} · {row.school.ownerName} · {row.school.phone}
          </p>
        </div>
      )
    },
    {
      key: "plan",
      header: "Current plan",
      cell: (row) => (
        <div>
          <p>{row.plan.name}</p>
          <p className="text-xs text-slate-500">
            {money(row.effectivePriceMinor, row.plan.currency)} {intervalLabel(row.plan)}
            {row.isCustomPrice ? " · custom" : ""}
          </p>
        </div>
      )
    },
    {
      key: "term",
      header: "Term",
      cell: (row) => (
        <div>
          <Badge tone={isLapsed(row) ? "danger" : row.daysLeft <= 7 ? "warn" : SUBSCRIPTION_STATUS[row.status].tone}>{daysLeftLabel(row.daysLeft)}</Badge>
          <p className="mt-0.5 text-xs text-slate-500">
            {SUBSCRIPTION_STATUS[row.status].label} · {fmtDate(row.currentPeriodEnd)}
          </p>
        </div>
      )
    },
    {
      key: "billing",
      header: "Billing",
      cell: (row) =>
        row.openInvoice ? (
          <div>
            <p>
              {row.openInvoice.number} · {money(row.openInvoice.totalMinor - row.openInvoice.amountPaidMinor, row.openInvoice.currency)} unpaid
            </p>
            <p className="text-xs text-slate-500">
              {row.paymentLink
                ? row.paymentLink.firstViewedAt
                  ? `Link opened ${timeAgo(row.paymentLink.firstViewedAt)}`
                  : "Link sent · not opened yet"
                : "No payment link sent"}
            </p>
          </div>
        ) : (
          <span className="text-slate-500">Not billed yet</span>
        )
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <RowActions>
          {!row.openInvoice ? (
            <Btn onClick={() => setDialog({ kind: "renew", row })} size="sm" variant="primary">
              Renew
            </Btn>
          ) : row.paymentLink ? (
            <CopyButton label="Copy link" text={row.paymentLink.url} />
          ) : (
            <Btn onClick={() => setDialog({ kind: "link", row })} size="sm" variant="primary">
              Send link
            </Btn>
          )}
          {row.openInvoice ? (
            <Btn onClick={() => setDialog({ kind: "paid", row })} size="sm">
              Mark paid
            </Btn>
          ) : null}
          <Btn onClick={() => setDrawerSchool(row.schoolId)} size="sm" variant="ghost">
            Details
          </Btn>
        </RowActions>
      )
    }
  ];

  const invoice = dialog ? asInvoice(dialog.row) : null;

  return (
    <>
      <PageHeader
        actions={
          <Btn loading={renewals.isRefreshing} onClick={() => void renewals.reload()} size="sm">
            Refresh
          </Btn>
        }
        description="Terms that have ended or end within 30 days, most urgent first. Renew sets the plan and price and collects payment in one step."
        title="Renewals"
      />

      <Tabs
        active={filter}
        onChange={setFilter}
        tabs={[
          { id: "all", label: "All due", count: counts.all },
          { id: "lapsed", label: "Overdue or expired", count: counts.lapsed },
          { id: "week", label: "Ending this week", count: counts.week },
          { id: "month", label: "Ending this month", count: counts.month }
        ]}
      />

      <Toolbar>
        <Input className="max-w-xs" onChange={(event) => setQuery(event.target.value)} placeholder="Search school, owner or phone" value={query} />
      </Toolbar>

      {renewals.error ? <ErrorBanner message={renewals.error} onRetry={() => void renewals.reload()} /> : null}
      <DataTable
        columns={columns}
        empty={filter === "all" ? "Nothing due — every school is paid up for the next 30 days." : "No schools in this group."}
        loading={renewals.isLoading}
        minWidth={900}
        rowKey={(row) => row.schoolId}
        rows={rows}
      />

      {dialog?.kind === "renew" ? (
        <RenewModal
          onClose={() => setDialog(null)}
          target={{
            schoolId: dialog.row.schoolId,
            schoolName: dialog.row.school.schoolName,
            planCode: dialog.row.plan.code,
            effectivePriceMinor: dialog.row.effectivePriceMinor,
            currentPeriodEnd: dialog.row.currentPeriodEnd
          }}
        />
      ) : null}
      {dialog?.kind === "link" && invoice ? (
        <PaymentLinkModal invoice={invoice} onClose={() => setDialog(null)} schoolName={dialog.row.school.schoolName} />
      ) : null}
      {dialog?.kind === "paid" && invoice ? <MarkPaidModal invoice={invoice} onClose={() => setDialog(null)} /> : null}
      {drawerSchool ? <SchoolBillingDrawer onClose={() => setDrawerSchool(null)} schoolId={drawerSchool} /> : null}
    </>
  );
}
