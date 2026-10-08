"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Btn, Card, CardHeader, ErrorBanner, FormModal, Field, TextArea, cx } from "../../../super-admin/_components/ui";
import { useAction } from "../../../super-admin/_lib/action";
import { fmtDate, fmtDateTime, timeAgo } from "../../../super-admin/_lib/format";
import { crmFetch } from "../../crmFetch";
import { LeadFormModal } from "../../_components/LeadFormModal";
import { STAGE, whatsappUrl } from "../../_lib/format";
import { invalidate, setResource, useResource } from "../../_lib/resource";
import type { Activity, LeadDetail, LeadStage } from "../../_lib/types";
import { BillingPanel } from "./BillingPanel";

/** How often to look again while the school is being set up. */
const SETUP_POLL_MS = 4000;

export default function LeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = use(params);
  const key = `/leads/${leadId}`;
  const lead = useResource<LeadDetail>(key);
  const [editing, setEditing] = useState(false);
  const [losing, setLosing] = useState(false);
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

  async function moveTo(stage: LeadStage, lostReason?: string) {
    return run(
      "stage",
      async () => {
        const updated = await crmFetch<LeadDetail>(key, { method: "PATCH", body: JSON.stringify({ stage, lostReason }) });
        setResource<LeadDetail>(key, () => updated);
        invalidate("/leads");
        return true;
      },
      `Moved to ${STAGE[stage].label}.`
    );
  }

  if (!data) {
    return (
      <>
        <BackLink />
        {lead.error ? <ErrorBanner message={lead.error} onRetry={() => void lead.reload()} /> : <p className="text-sm text-slate-500">Loading lead…</p>}
      </>
    );
  }

  const lastActivity = data.activities[0]?.createdAt ?? data.updatedAt;
  const canWork = data.stage !== "PAID" && data.stage !== "ONBOARDED";

  return (
    <>
      <BackLink />
      <header className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-slate-900">{data.schoolName}</h1>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">{data.code}</span>
            <Badge tone={STAGE[data.stage].tone}>{STAGE[data.stage].label}</Badge>
            {data.schoolId ? <Badge tone="good">School {data.schoolId}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Created {fmtDate(data.createdAt)} by {data.createdBy} · last activity {timeAgo(lastActivity)}
            {data.stage === "LOST" && data.lostReason ? ` · lost: ${data.lostReason}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.stage === "NEW" ? (
            <Btn loading={isPending("stage")} onClick={() => void moveTo("CONTACTED")} size="sm">
              Mark contacted
            </Btn>
          ) : null}
          {data.stage === "LOST" ? (
            <Btn loading={isPending("stage")} onClick={() => void moveTo("CONTACTED")} size="sm">
              Reopen
            </Btn>
          ) : null}
          {canWork && data.stage !== "LOST" ? (
            <Btn onClick={() => setLosing(true)} size="sm" variant="danger">
              Mark lost
            </Btn>
          ) : null}
          {data.stage !== "ONBOARDED" ? (
            <Btn onClick={() => setEditing(true)} size="sm">
              Edit details
            </Btn>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <Profile lead={data} />
        <Timeline lead={data} />
        <BillingPanel lead={data} />
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
          busy={isPending("stage")}
          onClose={() => setLosing(false)}
          onSubmit={async (reason) => {
            if (await moveTo("LOST", reason)) setLosing(false);
          }}
        />
      ) : null}
    </>
  );
}

function BackLink() {
  return (
    <Link className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800" href="/crm">
      ← Leads
    </Link>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">{children || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

function Profile({ lead }: { lead: LeadDetail }) {
  return (
    <Card className="self-start">
      <div className="flex items-center gap-3 border-b border-slate-100 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
          {lead.ownerName
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("")}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{lead.ownerName}</p>
          <p className="truncate text-xs text-slate-500">Principal / owner</p>
        </div>
      </div>
      <div className="flex gap-2 border-b border-slate-100 p-3">
        <a className="flex-1 rounded-md border border-slate-200 py-1.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`tel:${lead.phone}`}>
          Call
        </a>
        <a
          className="flex-1 rounded-md border border-green-200 bg-green-50 py-1.5 text-center text-xs font-semibold text-green-800 hover:bg-green-100"
          href={whatsappUrl(lead.phone, `Hello ${lead.ownerName}, `)}
          rel="noreferrer"
          target="_blank"
        >
          WhatsApp
        </a>
        <a className="flex-1 rounded-md border border-slate-200 py-1.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`mailto:${lead.email}`}>
          Email
        </a>
      </div>
      <dl className="grid gap-3 p-4">
        <Row label="Phone">{lead.phone}</Row>
        <Row label="Email">{lead.email}</Row>
        <Row label="Lead owner">{lead.assignedTo?.name ?? "Unassigned"}</Row>
        <div className="grid grid-cols-2 gap-3">
          <Row label="Students">{lead.numberOfStudents}</Row>
          <Row label="Staff">{lead.numberOfStaff}</Row>
        </div>
        <Row label="Address">{lead.address}</Row>
        <Row label="GSTIN">{lead.gstin ?? "Unregistered"}</Row>
        <Row label="State">{lead.stateName ? `${lead.stateName} (${lead.stateCode})` : null}</Row>
        <Row label="Source">{lead.source === "WEBSITE" ? "Website enquiry" : "Added in CRM"}</Row>
      </dl>
    </Card>
  );
}

const ACTIVITY_TONE: Record<string, string> = {
  NOTE: "bg-amber-400",
  PAYMENT_RECEIVED: "bg-green-500",
  ONBOARDED: "bg-green-500",
  PAYMENT_FAILED: "bg-red-500",
  ONBOARDING_FAILED: "bg-red-500",
  LINK_OPENED: "bg-blue-500",
  LINK_SHARED: "bg-blue-500",
  LINK_CREATED: "bg-blue-500",
  PROFORMA_ISSUED: "bg-indigo-500"
};

function Timeline({ lead }: { lead: LeadDetail }) {
  const key = `/leads/${lead.id}`;
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"all" | "notes">("all");
  const { run, isPending } = useAction();
  const items = filter === "notes" ? lead.activities.filter((activity) => activity.type === "NOTE") : lead.activities;

  async function addNote() {
    const text = note.trim();
    if (!text) return;
    const done = await run("note", async () => {
      const updated = await crmFetch<LeadDetail>(`${key}/notes`, { method: "POST", body: JSON.stringify({ text }) });
      setResource<LeadDetail>(key, () => updated);
      invalidate("/leads");
      return true;
    });
    if (done) setNote("");
  }

  return (
    // Below xl the columns stack; the proforma and school come before the long timeline.
    <Card className="order-last self-start xl:order-none">
      <CardHeader
        actions={
          <div className="flex gap-1">
            {(["all", "notes"] as const).map((id) => (
              <button
                className={cx("rounded px-2 py-1 text-xs font-semibold", filter === id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100")}
                key={id}
                onClick={() => setFilter(id)}
                type="button"
              >
                {id === "all" ? "All activity" : "Notes"}
              </button>
            ))}
          </div>
        }
        title="Activity"
      />
      <div className="border-b border-slate-100 p-3">
        <TextArea
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void addNote();
          }}
          placeholder="Add a note — what was discussed, what happens next…"
          value={note}
        />
        <div className="mt-2 flex justify-end">
          <Btn disabled={!note.trim()} loading={isPending("note")} onClick={() => void addNote()} size="sm" variant="primary">
            Add note
          </Btn>
        </div>
      </div>
      <ol className="max-h-[calc(100vh-280px)] overflow-y-auto p-3">
        {items.map((activity) => (
          <TimelineItem activity={activity} key={activity.id} />
        ))}
        {items.length === 0 ? <li className="p-3 text-sm text-slate-500">Nothing here yet.</li> : null}
      </ol>
    </Card>
  );
}

function TimelineItem({ activity }: { activity: Activity }) {
  const isNote = activity.type === "NOTE";
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <span className={cx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", ACTIVITY_TONE[activity.type] ?? "bg-slate-300")} />
      <div className={cx("min-w-0 flex-1", isNote && "rounded-md border border-amber-100 bg-amber-50/60 px-3 py-2")}>
        <p className="whitespace-pre-line break-words text-sm text-slate-800">{activity.message}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {activity.actor} · {fmtDateTime(activity.createdAt)}
        </p>
      </div>
    </li>
  );
}

function LostModal({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <FormModal
      danger
      description="It counts towards lost revenue. You can reopen it later."
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
      open
      submitDisabled={!reason.trim()}
      submitLabel="Mark lost"
      submitting={busy}
      title="Mark this lead lost"
    >
      <Field label="Why was it lost?">
        <TextArea autoFocus onChange={(event) => setReason(event.target.value)} placeholder="Chose another vendor, budget, not reachable…" value={reason} />
      </Field>
    </FormModal>
  );
}
