"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Btn, DataTable, ErrorBanner, Input, PageHeader, Select, cx, type Column } from "../super-admin/_components/ui";
import { fmtDate, money } from "../super-admin/_lib/format";
import { LeadFormModal } from "./_components/LeadFormModal";
import { STAGE, STAGES } from "./_lib/format";
import { useResource } from "./_lib/resource";
import { useCrmUser } from "./_lib/session";
import type { LeadList, LeadRow, LeadStage, TeamMember } from "./_lib/types";

function fmtTime(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function LeadsPage() {
  const router = useRouter();
  const user = useCrmUser();
  const isAdmin = user.role === "ADMIN";
  const [stage, setStage] = useState<LeadStage | "">("");
  const [owner, setOwner] = useState("");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const params = new URLSearchParams();
  if (stage) params.set("stage", stage);
  if (query) params.set("q", query);
  if (owner) params.set("assignedTo", owner);
  const key = `/leads${params.size ? `?${params}` : ""}`;

  const list = useResource<LeadList>(key);
  const team = useResource<TeamMember[]>(isAdmin ? "/team" : null);
  const total = Object.values(list.data?.counts ?? {}).reduce((sum, count) => sum + (count ?? 0), 0);

  const ownerOptions = [
    { value: "", label: "All owners" },
    { value: "unassigned", label: "Unassigned" },
    ...(team.data ?? []).map((member) => ({ value: member.id, label: member.name }))
  ];

  const columns: Array<Column<LeadRow>> = [
    {
      key: "lead",
      header: "Lead info",
      cell: (lead) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-slate-900">{lead.schoolName}</span>
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">{lead.code}</span>
          </div>
          <p className="truncate text-xs text-slate-500">
            {lead.ownerName}
            {lead.source === "WEBSITE" ? " · from website" : ""}
          </p>
        </div>
      )
    },
    {
      key: "contact",
      header: "Contact",
      cell: (lead) => (
        <div className="min-w-0 text-xs">
          <p className="font-medium text-slate-800">{lead.phone}</p>
          <p className="truncate text-slate-500">{lead.email}</p>
        </div>
      )
    },
    {
      key: "stage",
      header: "Stage",
      cell: (lead) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={STAGE[lead.stage].tone}>{STAGE[lead.stage].label}</Badge>
          {lead.stage === "PAID" && lead.onboardingStatus === "FAILED" ? <span className="text-[11px] font-semibold text-red-700">Setup failed</span> : null}
          {lead.schoolId ? <span className="text-[11px] font-semibold text-slate-500">{lead.schoolId}</span> : null}
        </div>
      )
    },
    {
      key: "owner",
      header: "Lead owner",
      cell: (lead) => (lead.assignedTo ? <span className="text-sm">{lead.assignedTo.name}</span> : <span className="text-xs text-slate-400">Unassigned</span>)
    },
    {
      key: "proforma",
      header: "Proforma",
      cell: (lead) =>
        lead.proforma ? (
          <div className="text-xs">
            <p className="text-sm font-semibold tabular-nums text-slate-900">{money(lead.proforma.totalMinor)}</p>
            <p className="text-slate-500">{lead.proforma.number}</p>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )
    },
    {
      key: "updated",
      header: "Last activity",
      cell: (lead) => (
        <div className="text-xs">
          <p className="font-medium text-slate-800">{fmtDate(lead.updatedAt)}</p>
          <p className="text-slate-500">{fmtTime(lead.updatedAt)}</p>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        actions={
          <Btn onClick={() => setAdding(true)} variant="primary">
            + Add lead
          </Btn>
        }
        description={isAdmin ? "Every lead, from first call to onboarded school." : "Your leads, from first call to onboarded school."}
        title="Leads"
      />

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {[{ id: "" as const, label: "All", count: total }, ...STAGES.map((entry) => ({ ...entry, count: list.data?.counts[entry.id] ?? 0 }))].map((entry) => (
          <button
            className={cx(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              stage === entry.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            )}
            key={entry.id || "all"}
            onClick={() => setStage(entry.id)}
            type="button"
          >
            {entry.label}
            <span className={cx("tabular-nums", stage === entry.id ? "text-slate-300" : "text-slate-400")}>{entry.count}</span>
          </button>
        ))}
      </div>

      <form
        className="mb-3 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(text.trim());
        }}
      >
        <Input
          aria-label="Search leads"
          className="max-w-xs"
          onChange={(event) => setText(event.target.value)}
          placeholder="Search by LD ID, school, principal, phone"
          value={text}
        />
        <Btn type="submit">Search</Btn>
        {query ? (
          <Btn
            onClick={() => {
              setText("");
              setQuery("");
            }}
            variant="ghost"
          >
            Clear
          </Btn>
        ) : null}
        {isAdmin ? (
          <div className="ml-auto w-48">
            <Select ariaLabel="Filter by lead owner" onChange={setOwner} options={ownerOptions} value={owner} />
          </div>
        ) : null}
      </form>

      {list.error ? <ErrorBanner message={list.error} onRetry={() => void list.reload()} /> : null}
      <DataTable
        columns={columns}
        empty={query || stage || owner ? "No leads match." : "No leads yet — add the first one."}
        loading={list.isLoading}
        minWidth={860}
        onRowClick={(lead) => router.push(`/crm/leads/${lead.id}`)}
        rowKey={(lead) => lead.id}
        rows={list.data?.leads}
      />

      {adding ? <LeadFormModal onClose={() => setAdding(false)} onCreated={(lead) => router.push(`/crm/leads/${lead.id}`)} /> : null}
    </>
  );
}
