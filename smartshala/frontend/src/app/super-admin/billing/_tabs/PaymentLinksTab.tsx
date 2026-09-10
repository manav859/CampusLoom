"use client";

import { useMemo, useState } from "react";
import { useAction } from "../../_lib/action";
import { fmtDate, linkStatus, money, timeAgo } from "../../_lib/format";
import { setResource, useResource } from "../../_lib/resource";
import type { PaymentLinkRow } from "../../_lib/types";
import { superAdminFetch } from "../../superAdminFetch";
import { invalidateBilling, whatsappShareUrl } from "../../_components/invoiceActions";
import { Badge, Btn, ConfirmModal, CopyButton, DataTable, ErrorBanner, RowActions, Select, Toolbar, type Column } from "../../_components/ui";

const KEY = "/billing/payment-links";

type Filter = "waiting" | "paid" | "closed" | "all";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "waiting", label: "Waiting for payment" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Revoked or expired" },
  { value: "all", label: "All links" }
];

function bucket(link: PaymentLinkRow): Exclude<Filter, "all"> {
  const status = linkStatus(link).label;
  if (status === "Paid") return "paid";
  if (status === "Waiting for payment") return "waiting";
  return "closed";
}

export function PaymentLinksTab({ onOpenSchool }: { onOpenSchool: (schoolId: string) => void }) {
  const links = useResource<PaymentLinkRow[]>(KEY);
  const { run, isPending } = useAction();
  const [filter, setFilter] = useState<Filter>("waiting");
  const [revoking, setRevoking] = useState<PaymentLinkRow | null>(null);

  const rows = useMemo(() => links.data?.filter((link) => filter === "all" || bucket(link) === filter), [filter, links.data]);

  const columns: Array<Column<PaymentLinkRow>> = [
    {
      key: "invoice",
      header: "Invoice",
      cell: (link) => (
        <div>
          <p className="font-medium">{link.invoice.number}</p>
          <p className="text-xs text-slate-500">{link.invoice.planName}</p>
        </div>
      )
    },
    {
      key: "school",
      header: "School",
      cell: (link) => (
        <button className="text-left hover:underline" onClick={() => onOpenSchool(link.school.schoolId)} type="button">
          <span className="block font-medium text-blue-700">{link.school.schoolName}</span>
          <span className="block text-xs text-slate-500">{link.school.schoolId}</span>
        </button>
      )
    },
    {
      key: "status",
      header: "Status",
      cell: (link) => {
        const status = linkStatus(link);
        return (
          <div>
            <Badge tone={status.tone}>{status.label}</Badge>
            <p className="mt-0.5 text-xs text-slate-500">
              {link.paidAt ? `Paid ${timeAgo(link.paidAt)}` : link.firstViewedAt ? `Opened ${timeAgo(link.firstViewedAt)}` : "Not opened yet"}
            </p>
          </div>
        );
      }
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (link) => <span className="font-medium tabular-nums">{money(link.amountMinor, link.currency)}</span>
    },
    { key: "expires", header: "Valid until", cell: (link) => <span className="text-slate-600">{fmtDate(link.expiresAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (link) =>
        bucket(link) === "waiting" ? (
          <RowActions>
            <CopyButton label="Copy link" text={link.url} />
            <a
              className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              href={whatsappShareUrl(link, link.school.schoolName)}
              rel="noreferrer"
              target="_blank"
            >
              WhatsApp
            </a>
            <Btn onClick={() => setRevoking(link)} size="sm" variant="danger">
              Revoke
            </Btn>
          </RowActions>
        ) : null
    }
  ];

  return (
    <>
      <Toolbar>
        <div className="w-52">
          <Select ariaLabel="Link status" onChange={setFilter} options={FILTERS} value={filter} />
        </div>
        <p className="text-sm text-slate-500">Create links from the Invoices tab, a school&apos;s billing, or Renewals.</p>
      </Toolbar>
      {links.error ? <ErrorBanner message={links.error} onRetry={() => void links.reload()} /> : null}
      <DataTable columns={columns} empty="No payment links here." loading={links.isLoading} minWidth={860} rowKey={(link) => link.id} rows={rows} />

      <ConfirmModal
        busy={isPending("revoke")}
        confirmLabel="Revoke link"
        danger
        message="Anyone holding this link will no longer be able to pay with it. The invoice stays open."
        onClose={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          const target = revoking;
          const updated = await run(
            "revoke",
            async () => {
              const result = await superAdminFetch<PaymentLinkRow>(`${KEY}/${target.id}/revoke`, { method: "POST" });
              setResource<PaymentLinkRow[]>(KEY, (current = []) => current.map((row) => (row.id === target.id ? result : row)));
              invalidateBilling(target.school.schoolId);
              return result;
            },
            "Payment link revoked."
          );
          if (updated) setRevoking(null);
        }}
        open={Boolean(revoking)}
        title={`Revoke the link for ${revoking?.invoice.number ?? ""}?`}
      />
    </>
  );
}
