"use client";

import { useMemo, useState } from "react";
import { SUBSCRIPTION_STATUS, daysLeftLabel, fmtDate, intervalLabel, money } from "../../_lib/format";
import { useResource } from "../../_lib/resource";
import type { SubscriptionRow, SubscriptionStatus } from "../../_lib/types";
import { Badge, Btn, DataTable, ErrorBanner, Input, RowActions, Select, Toolbar, type Column } from "../../_components/ui";

const DAY_MS = 86_400_000;

const STATUS_FILTERS: Array<{ value: "" | SubscriptionStatus; label: string }> = [
  { value: "", label: "All statuses" },
  ...(Object.keys(SUBSCRIPTION_STATUS) as SubscriptionStatus[]).map((status) => ({ value: status, label: SUBSCRIPTION_STATUS[status].label }))
];

export function SubscriptionsTab({ onOpenSchool }: { onOpenSchool: (schoolId: string) => void }) {
  // One request for the whole list; searching and filtering happen in the browser, instantly.
  const subscriptions = useResource<SubscriptionRow[]>("/billing/subscriptions");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | SubscriptionStatus>("");

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return subscriptions.data?.filter(
      (row) =>
        (!status || row.status === status) &&
        (!text || [row.school.schoolName, row.school.schoolId, row.school.email, row.plan.code].some((value) => value.toLowerCase().includes(text)))
    );
  }, [query, status, subscriptions.data]);

  const columns: Array<Column<SubscriptionRow>> = [
    {
      key: "school",
      header: "School",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.school.schoolName}</p>
          <p className="text-xs text-slate-500">{row.school.schoolId}</p>
        </div>
      )
    },
    { key: "plan", header: "Plan", cell: (row) => row.plan.name },
    {
      key: "price",
      header: "Price",
      cell: (row) => (
        <span className="whitespace-nowrap">
          <span className="tabular-nums">{money(row.customPriceMinor ?? row.plan.priceMinor, row.plan.currency)}</span>{" "}
          <span className="text-xs text-slate-500">{intervalLabel(row.plan)}</span>
          {row.customPriceMinor !== null ? <span className="ml-1 text-xs text-blue-700">custom</span> : null}
        </span>
      )
    },
    { key: "status", header: "Status", cell: (row) => <Badge tone={SUBSCRIPTION_STATUS[row.status].tone}>{SUBSCRIPTION_STATUS[row.status].label}</Badge> },
    {
      key: "term",
      header: "Term ends",
      cell: (row) => (
        <div>
          <p>{fmtDate(row.currentPeriodEnd)}</p>
          <p className="text-xs text-slate-500">{daysLeftLabel(Math.ceil((new Date(row.currentPeriodEnd).getTime() - Date.now()) / DAY_MS))}</p>
        </div>
      )
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <RowActions>
          <Btn onClick={() => onOpenSchool(row.schoolId)} size="sm">
            Manage
          </Btn>
        </RowActions>
      )
    }
  ];

  return (
    <>
      <Toolbar>
        <Input className="max-w-xs" onChange={(event) => setQuery(event.target.value)} placeholder="Search school, ID, email or plan" value={query} />
        <div className="w-44">
          <Select ariaLabel="Status filter" onChange={setStatus} options={STATUS_FILTERS} value={status} />
        </div>
        <span className="text-sm text-slate-500">{rows ? `${rows.length} school${rows.length === 1 ? "" : "s"}` : ""}</span>
      </Toolbar>
      {subscriptions.error ? <ErrorBanner message={subscriptions.error} onRetry={() => void subscriptions.reload()} /> : null}
      <DataTable
        columns={columns}
        empty="No subscriptions match."
        loading={subscriptions.isLoading}
        minWidth={760}
        onRowClick={(row) => onOpenSchool(row.schoolId)}
        rowKey={(row) => row.id}
        rows={rows}
      />
    </>
  );
}
