"use client";

import { useMemo, useState } from "react";
import { INVOICE_STATUS, fmtDate, money } from "../../_lib/format";
import { useResource } from "../../_lib/resource";
import type { Invoice, LedgerInvoice } from "../../_lib/types";
import { InvoiceActions } from "../../_components/invoiceActions";
import { Badge, DataTable, ErrorBanner, Input, Select, Toolbar, type Column } from "../../_components/ui";

const FILTERS: Array<{ value: "" | Invoice["status"]; label: string }> = [
  { value: "DUE", label: "Unpaid" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "", label: "All invoices" }
];

export function InvoicesTab({ onOpenSchool }: { onOpenSchool: (schoolId: string) => void }) {
  const [status, setStatus] = useState<"" | Invoice["status"]>("DUE");
  const [query, setQuery] = useState("");
  const invoices = useResource<LedgerInvoice[]>(status ? `/billing/invoices?status=${status}` : "/billing/invoices");

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return invoices.data;
    return invoices.data?.filter((invoice) =>
      [invoice.number, invoice.schoolId, invoice.school?.schoolName ?? "", invoice.planName].some((value) => value.toLowerCase().includes(text))
    );
  }, [invoices.data, query]);

  const total = rows?.reduce((sum, invoice) => sum + invoice.totalMinor - invoice.amountPaidMinor, 0) ?? 0;

  const columns: Array<Column<LedgerInvoice>> = [
    {
      key: "invoice",
      header: "Invoice",
      cell: (invoice) => (
        <div>
          <p className="font-medium">{invoice.number}</p>
          <p className="text-xs text-slate-500">{invoice.planName}</p>
        </div>
      )
    },
    {
      key: "school",
      header: "School",
      cell: (invoice) => (
        <button className="text-left hover:underline" onClick={() => onOpenSchool(invoice.schoolId)} type="button">
          <span className="block font-medium text-blue-700">{invoice.school?.schoolName ?? invoice.schoolId}</span>
          <span className="block text-xs text-slate-500">{invoice.schoolId}</span>
        </button>
      )
    },
    {
      key: "dates",
      header: "Issued / due",
      cell: (invoice) => (
        <div className="text-slate-600">
          <p>{fmtDate(invoice.issuedAt)}</p>
          <p className="text-xs">due {fmtDate(invoice.dueAt)}</p>
        </div>
      )
    },
    { key: "status", header: "Status", cell: (invoice) => <Badge tone={INVOICE_STATUS[invoice.status].tone}>{INVOICE_STATUS[invoice.status].label}</Badge> },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (invoice) => (
        <div className="tabular-nums">
          <p className="font-medium">{money(invoice.totalMinor, invoice.currency)}</p>
          {invoice.amountPaidMinor > 0 && invoice.amountPaidMinor < invoice.totalMinor ? (
            <p className="text-xs text-slate-500">{money(invoice.amountPaidMinor, invoice.currency)} paid</p>
          ) : null}
        </div>
      )
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (invoice) => <InvoiceActions invoice={invoice} schoolName={invoice.school?.schoolName ?? invoice.schoolId} />
    }
  ];

  return (
    <>
      <Toolbar>
        <div className="w-40">
          <Select ariaLabel="Invoice status" onChange={setStatus} options={FILTERS} value={status} />
        </div>
        <Input className="max-w-xs" onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice, school or plan" value={query} />
        {rows ? (
          <span className="text-sm text-slate-500">
            {rows.length} invoice{rows.length === 1 ? "" : "s"}
            {status === "DUE" && rows.length ? ` · ${money(total)} to collect` : ""}
          </span>
        ) : null}
      </Toolbar>
      {invoices.error ? <ErrorBanner message={invoices.error} onRetry={() => void invoices.reload()} /> : null}
      <DataTable
        columns={columns}
        empty={status === "DUE" ? "Nothing unpaid — every invoice is settled." : "No invoices match."}
        loading={invoices.isLoading}
        minWidth={880}
        rowKey={(invoice) => invoice.id}
        rows={rows}
      />
    </>
  );
}
