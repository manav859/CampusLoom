"use client";

import { use, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Btn, ErrorBanner, Field, FormModal, Input, Select, TextArea, cx } from "../../../super-admin/_components/ui";
import { useAction } from "../../../super-admin/_lib/action";
import { fmtDate, fmtDateTime } from "../../../super-admin/_lib/format";
import { crmFetch } from "../../crmFetch";
import { LeadFormModal } from "../../_components/LeadFormModal";
import { LostModal } from "../../_components/LostModal";
import { Glyph, Initials, type GLYPHS } from "../../_components/visual";
import { STAGE, STAGE_DOT, STAGES, canMoveTo, whatsappUrl } from "../../_lib/format";
import { invalidate, setResource, useResource } from "../../_lib/resource";
import { useCrmUser } from "../../_lib/session";
import type { Activity, LeadDetail, LeadStage, TeamMember } from "../../_lib/types";
import { BillingPanel } from "./BillingPanel";

/** How often to look again while the school is being set up. */
const SETUP_POLL_MS = 4000;

export default function DealPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = use(params);
  const key = `/leads/${leadId}`;
  const lead = useResource<LeadDetail>(key);
  const [editing, setEditing] = useState(false);
  const [losing, setLosing] = useState(false);
  const [noting, setNoting] = useState(false);
  const { run, isPending } = useAction();
  const data = lead.data;

  // Payment lands and setup runs on the server; keep the page honest while it does.
  const settingUp = data?.stage === "PAID" && (data.onboardingStatus === "RUNNING" || data.onboardingStatus === "NOT_STARTED");
  const { reload } = lead;
  useEffect(() => {
    if (!settingUp) return;
    const timer = window.setInterval(() => void reload(), SETUP_POLL_MS);
    return () => window.clearInterval(timer);
  }, [settingUp, reload]);

  async function update(body: Record<string, unknown>, success: string) {
    return run(
      "update",
      async () => {
        const updated = await crmFetch<LeadDetail>(key, { method: "PATCH", body: JSON.stringify(body) });
        setResource<LeadDetail>(key, () => updated);
        invalidate("/leads");
        return true;
      },
      success
    );
  }

  if (!data) {
    return (
      <>
        <BackLink />
        {lead.error ? <ErrorBanner message={lead.error} onRetry={() => void lead.reload()} /> : <p className="text-sm text-slate-500">Loading deal…</p>}
      </>
    );
  }

  const lastActivity = data.activities[0]?.createdAt ?? data.updatedAt;
  const canWork = data.stage !== "PAID" && data.stage !== "ONBOARDED";
  const actions = [
    ...(data.stage !== "ONBOARDED" ? [{ label: "Edit details", onClick: () => setEditing(true) }] : []),
    ...(canWork && data.stage !== "LOST" ? [{ label: "Mark lost", onClick: () => setLosing(true), danger: true }] : [])
  ];

  return (
    <>
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white xl:grid xl:min-h-[calc(100vh-3rem)] xl:grid-cols-[290px_minmax(0,1fr)_360px]">
        <aside className="order-1 border-b border-slate-200 p-4 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between gap-2">
            <BackLink />
            <ActionsMenu items={actions} />
          </div>
          <Profile
            busy={isPending("update")}
            lead={data}
            onNote={() => setNoting(true)}
            onOwner={(assignedToId) => void update({ assignedToId }, "Deal owner changed.")}
            onStage={(stage) => (stage === "LOST" ? setLosing(true) : void update({ stage }, `Moved to ${STAGE[stage].label}.`))}
          />
        </aside>

        <section className="order-3 min-w-0 bg-slate-50/70 p-4 xl:order-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile icon="calendar" label="Created" value={fmtDate(data.createdAt)} />
            <StatTile
              icon="flag"
              label="Deal stage"
              value={
                <span className="flex items-center gap-1.5">
                  <span className={cx("h-2 w-2 rounded-full", STAGE_DOT[STAGE[data.stage].tone])} />
                  {STAGE[data.stage].label}
                </span>
              }
            />
            <StatTile icon="clock" label="Last activity" value={fmtDate(lastActivity)} />
          </div>
          <Timeline activities={data.activities} onNote={() => setNoting(true)} />
        </section>

        <aside className="order-2 min-w-0 border-b border-slate-200 p-4 xl:order-3 xl:border-b-0 xl:border-l">
          <BillingPanel lead={data} />
        </aside>
      </div>

      {editing ? (
        <LeadFormModal
          lead={data}
          onClose={() => {
            setEditing(false);
            void reload();
          }}
        />
      ) : null}
      {losing ? (
        <LostModal
          busy={isPending("update")}
          onClose={() => setLosing(false)}
          onSubmit={async (reason) => {
            if (await update({ stage: "LOST", lostReason: reason }, "Moved to Lost.")) setLosing(false);
          }}
        />
      ) : null}
      {noting ? <NoteModal leadId={data.id} onClose={() => setNoting(false)} /> : null}
    </>
  );
}

function BackLink() {
  return (
    <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900" href="/crm">
      <Glyph name="back" />
      Deals
    </Link>
  );
}

function ActionsMenu({ items }: { items: Array<{ label: string; onClick: () => void; danger?: boolean }> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!items.length) return null;
  return (
    <div className="relative" ref={ref}>
      <Btn aria-expanded={open} onClick={() => setOpen((current) => !current)} size="sm">
        Actions
        <Glyph className="h-3.5 w-3.5" name="chevron" />
      </Btn>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-slate-200 bg-white py-1 shadow-lg" role="menu">
          {items.map((item) => (
            <button
              className={cx("block w-full px-3 py-2 text-left text-sm hover:bg-slate-50", item.danger ? "text-red-700" : "text-slate-700")}
              key={item.label}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              role="menuitem"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{children}</p>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">{children || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

function QuickAction({ icon, label, href, onClick }: { icon: keyof typeof GLYPHS; label: string; href?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors group-hover:border-slate-300 group-hover:text-slate-900">
        <Glyph name={icon} />
      </span>
      <span className="text-[11px] font-medium text-slate-600">{label}</span>
    </>
  );
  const className = "group flex flex-col items-center gap-1";
  return href ? (
    <a className={className} href={href} rel="noreferrer" target={href.startsWith("http") ? "_blank" : undefined}>
      {body}
    </a>
  ) : (
    <button className={className} onClick={onClick} type="button">
      {body}
    </button>
  );
}

function Profile({
  lead,
  busy,
  onNote,
  onStage,
  onOwner
}: {
  lead: LeadDetail;
  busy: boolean;
  onNote: () => void;
  onStage: (stage: LeadStage) => void;
  onOwner: (assignedToId: string) => void;
}) {
  const user = useCrmUser();
  const isAdmin = user.role === "ADMIN";
  const team = useResource<TeamMember[]>(isAdmin ? "/team" : null);
  const stageOptions = STAGES.filter((stage) => stage.id === lead.stage || canMoveTo(lead.stage, stage.id)).map((stage) => ({ value: stage.id, label: stage.label }));
  const ownerOptions = [
    { value: "", label: "Unassigned" },
    ...(team.data ?? []).filter((member) => member.isActive || member.id === lead.assignedToId).map((member) => ({ value: member.id, label: member.name }))
  ];

  return (
    <>
      <div className="mt-5 flex items-center gap-3">
        <Initials name={lead.schoolName} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900">{lead.schoolName}</h1>
          <p className="truncate text-xs text-slate-500">{lead.email}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
            {lead.code}
            {lead.schoolId ? <span className="text-green-700"> · School {lead.schoolId}</span> : null}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1 border-b border-slate-100 pb-4">
        <QuickAction icon="note" label="Note" onClick={onNote} />
        <QuickAction href={`mailto:${lead.email}`} icon="email" label="Email" />
        <QuickAction href={`tel:${lead.phone}`} icon="call" label="Call" />
        <QuickAction href={whatsappUrl(lead.phone, `Hello ${lead.ownerName}, `)} icon="chat" label="WhatsApp" />
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <SectionLabel>Deal stage</SectionLabel>
          {stageOptions.length > 1 ? (
            <div className={cx(busy && "pointer-events-none opacity-60")}>
              <Select ariaLabel="Deal stage" onChange={onStage} options={stageOptions} value={lead.stage} />
            </div>
          ) : (
            <p className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
              <span className={cx("h-2 w-2 rounded-full", STAGE_DOT[STAGE[lead.stage].tone])} />
              {STAGE[lead.stage].label}
              <span className="ml-auto text-[11px] font-normal text-slate-400">set by payment</span>
            </p>
          )}
          {lead.stage === "LOST" && lead.lostReason ? <p className="mt-1.5 text-xs text-red-700">Lost: {lead.lostReason}</p> : null}
        </div>

        <div>
          <SectionLabel>Deal owner</SectionLabel>
          {isAdmin ? (
            <div className={cx(busy && "pointer-events-none opacity-60")}>
              <Select ariaLabel="Deal owner" onChange={onOwner} options={ownerOptions} value={lead.assignedToId ?? ""} />
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Initials name={lead.assignedTo?.name} />
              {lead.assignedTo?.name ?? "Unassigned"}
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <SectionLabel>School details</SectionLabel>
          <dl className="grid gap-3">
            <Row label="Principal / owner">{lead.ownerName}</Row>
            <Row label="Phone">{lead.phone}</Row>
            <Row label="Email">{lead.email}</Row>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Students">{lead.numberOfStudents}</Row>
              <Row label="Staff">{lead.numberOfStaff}</Row>
            </div>
            <Row label="Address">{lead.address}</Row>
            <Row label="GSTIN">{lead.gstin ?? "Unregistered"}</Row>
            <Row label="State">{lead.stateName ? `${lead.stateName} (${lead.stateCode})` : null}</Row>
            <Row label="Source">{lead.source === "WEBSITE" ? "Website enquiry" : "Added in CRM"}</Row>
            <Row label="Created">{`${fmtDateTime(lead.createdAt)} by ${lead.createdBy}`}</Row>
          </dl>
        </div>
      </div>
    </>
  );
}

function StatTile({ icon, label, value }: { icon: keyof typeof GLYPHS; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
        <Glyph name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="truncate text-sm font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

type Tab = "all" | "notes" | "billing" | "updates";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "all", label: "All activities" },
  { id: "notes", label: "Notes" },
  { id: "billing", label: "Billing" },
  { id: "updates", label: "Updates" }
];

const ACTIVITY_TITLE: Record<string, string> = {
  NOTE: "Note",
  CREATED: "Deal created",
  ENQUIRY: "Website enquiry",
  PROFORMA_ISSUED: "Proforma issued",
  PROFORMA_CANCELLED: "Proforma cancelled",
  LINK_CREATED: "Payment link created",
  LINK_SHARED: "Payment link shared",
  LINK_OPENED: "Payment link opened",
  LINK_REVOKED: "Payment link revoked",
  PAYMENT_RECEIVED: "Payment received",
  PAYMENT_FAILED: "Payment failed",
  ONBOARDING: "School setup",
  ONBOARDING_FAILED: "School setup failed",
  LOGIN_ISSUED: "Login details issued"
};

function describe(activity: Activity) {
  const tab: Tab = activity.type === "NOTE" ? "notes" : /^(PROFORMA|LINK|PAYMENT)_/.test(activity.type) ? "billing" : "updates";
  let title = ACTIVITY_TITLE[activity.type];
  if (!title && activity.type === "UPDATED") {
    title = activity.message.startsWith("Stage:") ? "Stage changed" : /^(Assigned|Unassigned)/.test(activity.message) ? "Owner changed" : "Details updated";
  }
  const icon: keyof typeof GLYPHS = tab === "notes" ? "note" : tab === "billing" ? "card" : "edit";
  const tone = /FAILED$/.test(activity.type)
    ? "bg-red-50 text-red-600"
    : activity.type === "PAYMENT_RECEIVED" || activity.type === "ONBOARDING"
      ? "bg-green-50 text-green-600"
      : tab === "notes"
        ? "bg-amber-50 text-amber-600"
        : "bg-blue-50 text-blue-600";
  const fallback = activity.type.replace(/_/g, " ").toLowerCase();
  return { tab, title: title ?? fallback.charAt(0).toUpperCase() + fallback.slice(1), icon, tone };
}

function Timeline({ activities, onNote }: { activities: Activity[]; onNote: () => void }) {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const described = activities.map((activity) => ({ activity, ...describe(activity) }));
  const needle = search.trim().toLowerCase();
  const items = described.filter(
    (item) =>
      (tab === "all" || item.tab === tab) &&
      (!needle || `${item.title} ${item.activity.message} ${item.activity.actor}`.toLowerCase().includes(needle))
  );

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
        <Btn onClick={onNote} size="sm">
          <Glyph className="h-3.5 w-3.5" name="note" />
          Add note
        </Btn>
      </div>
      <div className="relative mt-3">
        <Glyph className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" name="search" />
        <Input aria-label="Search activities" className="pl-8" onChange={(event) => setSearch(event.target.value)} placeholder="Search activities" value={search} />
      </div>
      <div className="mt-3 flex gap-4 overflow-x-auto border-b border-slate-200">
        {TABS.map((entry) => {
          const count = entry.id === "all" ? described.length : described.filter((item) => item.tab === entry.id).length;
          return (
            <button
              className={cx(
                "-mb-px shrink-0 border-b-2 pb-2 text-sm font-medium transition-colors",
                tab === entry.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
              )}
              key={entry.id}
              onClick={() => setTab(entry.id)}
              type="button"
            >
              {entry.label} <span className="text-xs tabular-nums text-slate-400">{count}</span>
            </button>
          );
        })}
      </div>

      <ol className="mt-3 space-y-2">
        {items.map(({ activity, title, icon, tone }) => (
          <li className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3" key={activity.id}>
            <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", tone)}>
              <Glyph name={icon} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500">{fmtDateTime(activity.createdAt)}</p>
              </div>
              {activity.type !== "CREATED" ? <p className="mt-0.5 whitespace-pre-line break-words text-sm text-slate-700">{activity.message}</p> : null}
              <p className="mt-0.5 text-xs text-slate-500">{activity.actor}</p>
            </div>
          </li>
        ))}
        {items.length === 0 ? <li className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">Nothing here yet.</li> : null}
      </ol>
    </div>
  );
}

function NoteModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const key = `/leads/${leadId}`;
  const [text, setText] = useState("");
  const { run, isPending } = useAction();

  async function save() {
    const done = await run(
      "note",
      async () => {
        const updated = await crmFetch<LeadDetail>(`${key}/notes`, { method: "POST", body: JSON.stringify({ text: text.trim() }) });
        setResource<LeadDetail>(key, () => updated);
        invalidate("/leads");
        return true;
      },
      "Note added."
    );
    if (done) onClose();
  }

  return (
    <FormModal onClose={onClose} onSubmit={() => void save()} open submitDisabled={!text.trim()} submitLabel="Add note" submitting={isPending("note")} title="Add a note">
      <Field label="What was discussed, what happens next">
        <TextArea
          autoFocus
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && text.trim()) void save();
          }}
          rows={5}
          value={text}
        />
      </Field>
    </FormModal>
  );
}
