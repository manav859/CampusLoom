"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Btn, DataTable, ErrorBanner, Input, PageHeader, Select, cx, type Column } from "../super-admin/_components/ui";
import { useAction } from "../super-admin/_lib/action";
import { fmtDate, money, timeAgo } from "../super-admin/_lib/format";
import { crmFetch } from "./crmFetch";
import { LeadFormModal } from "./_components/LeadFormModal";
import { LostModal } from "./_components/LostModal";
import { Glyph, Initials } from "./_components/visual";
import { STAGE, STAGE_DOT, STAGES, canMoveTo } from "./_lib/format";
import { invalidate, setResource, useResource } from "./_lib/resource";
import { useCrmUser } from "./_lib/session";
import type { LeadList, LeadRow, LeadStage, TeamMember } from "./_lib/types";

type View = "board" | "table";

function fmtTime(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function DealsPage() {
  const router = useRouter();
  const user = useCrmUser();
  const isAdmin = user.role === "ADMIN";
  const [view, setView] = useState<View>("board");
  const [stage, setStage] = useState<LeadStage | "">("");
  const [owner, setOwner] = useState("");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [losing, setLosing] = useState<LeadRow | null>(null);
  const { run, isPending } = useAction();

  // The board shows every stage as a column, so only the table filters by stage.
  const stageFilter = view === "table" ? stage : "";
  const params = new URLSearchParams();
  if (stageFilter) params.set("stage", stageFilter);
  if (query) params.set("q", query);
  if (owner) params.set("assignedTo", owner);
  const key = `/leads${params.size ? `?${params}` : ""}`;

  const list = useResource<LeadList>(key);
  const team = useResource<TeamMember[]>(isAdmin ? "/team" : null);
  const total = Object.values(list.data?.counts ?? {}).reduce((sum, count) => sum + (count ?? 0), 0);
  const filtered = Boolean(query || owner || stageFilter);

  const ownerOptions = [
    { value: "", label: "All owners" },
    { value: "unassigned", label: "Unassigned" },
    ...(team.data ?? []).map((member) => ({ value: member.id, label: member.name }))
  ];
  const stageOptions = [
    { value: "" as const, label: `All stages (${total})` },
    ...STAGES.map((entry) => ({ value: entry.id, label: `${entry.label} (${list.data?.counts[entry.id] ?? 0})` }))
  ];

  function open(deal: LeadRow) {
    router.push(`/crm/deals/${deal.id}`);
  }

  async function move(deal: LeadRow, to: LeadStage, lostReason?: string) {
    const current = list.data;
    if (!current) return undefined;
    // Move the card now; the refetch puts it back if the server says no.
    setResource<LeadList>(key, () => ({ ...current, leads: current.leads.map((row) => (row.id === deal.id ? { ...row, stage: to } : row)) }));
    return run(
      "move",
      async () => {
        try {
          await crmFetch(`/leads/${deal.id}`, { method: "PATCH", body: JSON.stringify({ stage: to, lostReason }) });
        } finally {
          invalidate("/leads");
        }
        return true;
      },
      `${deal.schoolName} moved to ${STAGE[to].label}.`
    );
  }

  const columns: Array<Column<LeadRow>> = [
    {
      key: "deal",
      header: "Deal info",
      cell: (deal) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-slate-900">{deal.schoolName}</span>
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">{deal.code}</span>
          </div>
          <p className="truncate text-xs text-slate-500">
            {deal.ownerName}
            {deal.source === "WEBSITE" ? " · from website" : ""}
          </p>
        </div>
      )
    },
    {
      key: "contact",
      header: "Contact",
      cell: (deal) => (
        <div className="min-w-0 text-xs">
          <p className="font-medium text-slate-800">{deal.phone}</p>
          <p className="truncate text-slate-500">{deal.email}</p>
        </div>
      )
    },
    {
      key: "stage",
      header: "Deal stage",
      cell: (deal) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={STAGE[deal.stage].tone}>{STAGE[deal.stage].label}</Badge>
          {deal.stage === "PAID" && deal.onboardingStatus === "FAILED" ? <span className="text-[11px] font-semibold text-red-700">Setup failed</span> : null}
          {deal.schoolId ? <span className="text-[11px] font-semibold text-slate-500">{deal.schoolId}</span> : null}
        </div>
      )
    },
    {
      key: "owner",
      header: "Deal owner",
      cell: (deal) => (
        <span className="flex items-center gap-1.5 text-sm">
          <Initials name={deal.assignedTo?.name} />
          {deal.assignedTo ? deal.assignedTo.name : <span className="text-xs text-slate-400">Unassigned</span>}
        </span>
      )
    },
    {
      key: "proforma",
      header: "Proforma",
      cell: (deal) =>
        deal.proforma ? (
          <div className="text-xs">
            <p className="text-sm font-semibold tabular-nums text-slate-900">{money(deal.proforma.totalMinor)}</p>
            <p className="text-slate-500">{deal.proforma.number}</p>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )
    },
    {
      key: "updated",
      header: "Last activity",
      cell: (deal) => (
        <div className="text-xs">
          <p className="font-medium text-slate-800">{fmtDate(deal.updatedAt)}</p>
          <p className="text-slate-500">{fmtTime(deal.updatedAt)}</p>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        actions={
          <Btn onClick={() => setAdding(true)} variant="primary">
            + Create deal
          </Btn>
        }
        description={isAdmin ? "Every deal, from first call to onboarded school." : "Your deals, from first call to onboarded school."}
        title="Deals"
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(text.trim());
          }}
        >
          <div className="relative">
            <Glyph className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" name="search" />
            <Input
              aria-label="Search deals"
              className="w-72 pl-8"
              onChange={(event) => setText(event.target.value)}
              placeholder="Search deals or deal ID"
              value={text}
            />
          </div>
          <Btn type="submit">Search</Btn>
        </form>

        <div className="ml-auto inline-flex rounded-md border border-slate-200 bg-white p-0.5">
          {(["table", "board"] as const).map((id) => (
            <button
              aria-pressed={view === id}
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors",
                view === id ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-800"
              )}
              key={id}
              onClick={() => setView(id)}
              type="button"
            >
              <Glyph name={id} />
              {id === "table" ? "Table" : "Board"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {view === "table" ? (
          <div className="w-52">
            <Select ariaLabel="Filter by deal stage" onChange={setStage} options={stageOptions} value={stage} />
          </div>
        ) : null}
        {isAdmin ? (
          <div className="w-52">
            <Select ariaLabel="Filter by deal owner" onChange={setOwner} options={ownerOptions} value={owner} />
          </div>
        ) : null}
        {filtered ? (
          <button
            className="px-1 text-xs font-semibold text-blue-700 hover:underline"
            onClick={() => {
              setText("");
              setQuery("");
              setOwner("");
              setStage("");
            }}
            type="button"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {list.error ? <ErrorBanner message={list.error} onRetry={() => void list.reload()} /> : null}

      {view === "board" ? (
        <Board
          deals={list.data?.leads ?? []}
          loading={list.isLoading}
          onMove={(deal, to) => (to === "LOST" ? setLosing(deal) : void move(deal, to))}
          onOpen={open}
        />
      ) : (
        <DataTable
          columns={columns}
          empty={filtered ? "No deals match." : "No deals yet — create the first one."}
          loading={list.isLoading}
          minWidth={860}
          onRowClick={open}
          rowKey={(deal) => deal.id}
          rows={list.data?.leads}
        />
      )}

      {adding ? <LeadFormModal onClose={() => setAdding(false)} onCreated={open} /> : null}
      {losing ? (
        <LostModal
          busy={isPending("move")}
          onClose={() => setLosing(null)}
          onSubmit={async (reason) => {
            if (await move(losing, "LOST", reason)) setLosing(null);
          }}
        />
      ) : null}
    </>
  );
}

function Board({
  deals,
  loading,
  onOpen,
  onMove
}: {
  deals: LeadRow[];
  loading: boolean;
  onOpen: (deal: LeadRow) => void;
  onMove: (deal: LeadRow, to: LeadStage) => void;
}) {
  const [dragging, setDragging] = useState<LeadRow | null>(null);
  const [over, setOver] = useState<LeadStage | null>(null);

  function endDrag() {
    setDragging(null);
    setOver(null);
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:-mx-6 lg:px-6">
      <div className="flex min-w-max gap-3">
        {STAGES.map((column) => {
          const cards = deals.filter((deal) => deal.stage === column.id);
          const droppable = dragging ? canMoveTo(dragging.stage, column.id) : false;
          return (
            <section
              className={cx(
                "flex w-72 shrink-0 flex-col rounded-lg border transition-colors",
                over === column.id && droppable ? "border-blue-400 bg-blue-50/70" : "border-slate-200 bg-slate-100/60",
                dragging && !droppable && dragging.stage !== column.id && "opacity-50"
              )}
              key={column.id}
              onDragLeave={() => setOver((current) => (current === column.id ? null : current))}
              onDragOver={(event) => {
                if (!droppable) return;
                event.preventDefault();
                setOver(column.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragging && droppable) onMove(dragging, column.id);
                endDrag();
              }}
            >
              <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
                <span className={cx("h-2 w-2 rounded-full", STAGE_DOT[column.tone])} />
                <h2 className="text-sm font-semibold text-slate-800">{column.label}</h2>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200">
                  {cards.length}
                </span>
              </header>
              <div className="flex max-h-[calc(100vh-290px)] min-h-[180px] flex-col gap-2 overflow-y-auto p-2">
                {cards.map((deal) => (
                  <DealCard
                    deal={deal}
                    draggable={STAGES.some((target) => canMoveTo(deal.stage, target.id))}
                    key={deal.id}
                    onDragEnd={endDrag}
                    onDragStart={() => setDragging(deal)}
                    onOpen={() => onOpen(deal)}
                  />
                ))}
                {!cards.length ? (
                  <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400">
                    {loading ? "Loading…" : STAGES.some((source) => canMoveTo(source.id, column.id)) ? "Drop deals here" : "No deals"}
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  draggable,
  onOpen,
  onDragStart,
  onDragEnd
}: {
  deal: LeadRow;
  draggable: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      className={cx(
        "rounded-md border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      )}
      draggable={draggable}
      onClick={onOpen}
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", deal.id);
        onDragStart();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
      }}
      role="link"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{deal.schoolName}</p>
        <span className="shrink-0 pt-0.5 text-[10px] font-semibold text-slate-400">{deal.code}</span>
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600">
        <Initials name={deal.assignedTo?.name} />
        <span className="truncate">{deal.assignedTo?.name ?? "Unassigned"}</span>
      </p>
      {deal.proforma ? (
        <p className="mt-1.5 text-xs font-semibold tabular-nums text-slate-800">
          {money(deal.proforma.totalMinor)} <span className="font-normal text-slate-500">· {deal.proforma.number}</span>
        </p>
      ) : null}
      {deal.stage === "PAID" && deal.onboardingStatus === "FAILED" ? <p className="mt-1 text-[11px] font-semibold text-red-700">Setup failed</p> : null}
      {deal.schoolId ? <p className="mt-1 text-[11px] font-semibold text-slate-500">School {deal.schoolId}</p> : null}
      <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <p>Created {fmtDate(deal.createdAt)}</p>
        <p>Last activity {timeAgo(deal.updatedAt)}</p>
      </div>
    </div>
  );
}
