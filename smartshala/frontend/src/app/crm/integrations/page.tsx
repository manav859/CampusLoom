"use client";

import { useEffect, useState } from "react";
import { Badge, Btn, Callout, Card, CardHeader, Checkbox, ConfirmModal, ErrorBanner, Field, FormModal, Input, KeyValue, PageHeader } from "../../super-admin/_components/ui";
import { useAction } from "../../super-admin/_lib/action";
import { timeAgo } from "../../super-admin/_lib/format";
import { crmFetch } from "../crmFetch";
import { invalidate, setResource, useResource } from "../_lib/resource";
import { useCrmUser } from "../_lib/session";
import type { MetaForm, MetaStatus, MetaSyncResult } from "../_lib/types";

const STATUS_KEY = "/integrations/meta";
const FORMS_KEY = "/integrations/meta/forms";

export default function IntegrationsPage() {
  const user = useCrmUser();
  const status = useResource<MetaStatus>(user.role === "ADMIN" ? STATUS_KEY : null);

  if (user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Only a sales admin can manage integrations.</p>;
  }

  return (
    <>
      <PageHeader description="Bring leads into the CRM from other places." title="Integrations" />
      {status.error ? <ErrorBanner message={status.error} onRetry={() => void status.reload()} /> : null}
      {status.data ? <MetaCard status={status.data} /> : status.isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
    </>
  );
}

function syncMessage(result: MetaSyncResult) {
  const parts = [`${result.created} new deal${result.created === 1 ? "" : "s"}`];
  if (result.merged) parts.push(`${result.merged} added to existing deals`);
  if (result.failed) parts.push(`${result.failed} failed — they will be retried`);
  return `Meta sync done: ${parts.join(", ")}.`;
}

function MetaCard({ status }: { status: MetaStatus }) {
  const { run, isPending } = useAction();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function syncNow() {
    await run(
      "sync",
      async () => {
        const result = await crmFetch<MetaSyncResult>("/integrations/meta/sync", { method: "POST" });
        invalidate("/leads");
        return result;
      },
      syncMessage
    );
    // A failed sync records its error on the integration; show it either way.
    invalidate(STATUS_KEY);
  }

  return (
    <Card>
      <CardHeader
        actions={
          status.connected ? (
            <>
              <Btn loading={isPending("sync")} onClick={() => void syncNow()} size="sm" variant="primary">
                Sync now
              </Btn>
              <Btn onClick={() => setConnecting(true)} size="sm">
                Change token
              </Btn>
              <Btn onClick={() => setDisconnecting(true)} size="sm" variant="danger">
                Disconnect
              </Btn>
            </>
          ) : (
            <Btn onClick={() => setConnecting(true)} size="sm" variant="primary">
              Connect
            </Btn>
          )
        }
        description="Leads from your Facebook and Instagram lead ad forms become deals, shared out in turn among active salespeople."
        title={
          <span className="flex items-center gap-2">
            Meta lead ads
            <Badge tone={status.connected ? (status.lastSyncError ? "danger" : "good") : "neutral"}>
              {status.connected ? (status.lastSyncError ? "Sync failing" : "Connected") : "Not connected"}
            </Badge>
          </span>
        }
      />
      <div className="space-y-4 p-4">
        {status.connected ? (
          <>
            {status.lastSyncError ? (
              <Callout tone="danger">
                The last sync failed: {status.lastSyncError}. If the token expired or lost access, use Change token.
              </Callout>
            ) : null}
            <KeyValue
              items={[
                ["Page", `${status.pageName} (${status.pageId})`],
                ["Last synced", status.lastSyncedAt ? timeAgo(status.lastSyncedAt) : "Not yet"],
                ["Deals from Meta", status.imported],
                ["Connected by", status.connectedBy]
              ]}
            />
            <p className="text-xs text-slate-500">
              {status.autoSync
                ? "New leads are checked for every 10 minutes."
                : "Automatic checks are off on this server, so leads come in only when you press Sync now."}{" "}
              A lead whose phone or email matches an open deal is added to that deal&apos;s timeline instead of creating a new one.
            </p>
            <FormPicker status={status} />
          </>
        ) : (
          <SetupSteps />
        )}
      </div>

      {connecting ? <ConnectModal current={status.connected ? status.pageId : ""} onClose={() => setConnecting(false)} /> : null}
      <ConfirmModal
        busy={isPending("disconnect")}
        confirmLabel="Disconnect"
        danger
        message="No more leads will come in from Meta. Deals already imported stay, and reconnecting will not import them again."
        onClose={() => setDisconnecting(false)}
        onConfirm={async () => {
          const done = await run(
            "disconnect",
            async () => {
              await crmFetch(STATUS_KEY, { method: "DELETE" });
              setResource<MetaStatus>(STATUS_KEY, () => ({ connected: false }));
              return true;
            },
            "Meta disconnected."
          );
          if (done) setDisconnecting(false);
        }}
        open={disconnecting}
        title="Disconnect Meta?"
      />
    </Card>
  );
}

function SetupSteps() {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
      <li>
        In Meta Business Settings, open <b>Users → System users</b>, add a system user, and under <b>Assign assets</b> give it your Facebook Page.
      </li>
      <li>
        Click <b>Generate token</b>, pick your Meta app, and tick <b>leads_retrieval</b>, <b>pages_show_list</b>, <b>pages_read_engagement</b>,{" "}
        <b>pages_manage_ads</b> and <b>ads_read</b>. Choose a token that never expires.
      </li>
      <li>
        If your business uses <b>Integrations → Leads access</b>, allow that system user there.
      </li>
      <li>
        Copy your Page ID (Page → About → Page transparency), then press <b>Connect</b> and paste both.
      </li>
    </ol>
  );
}

function ConnectModal({ current, onClose }: { current: string; onClose: () => void }) {
  const { run, isPending } = useAction();
  const [pageId, setPageId] = useState(current);
  const [accessToken, setAccessToken] = useState("");
  const valid = /^\d{5,25}$/.test(pageId.trim()) && accessToken.trim().length >= 20;

  return (
    <FormModal
      description="The token is checked with Meta before it is saved, and stored encrypted."
      onClose={onClose}
      onSubmit={async () => {
        const status = await run(
          "connect",
          () => crmFetch<MetaStatus>(STATUS_KEY, { method: "PUT", body: JSON.stringify({ pageId: pageId.trim(), accessToken: accessToken.trim() }) }),
          (result) => (result.connected ? `Connected to ${result.pageName}.` : "Connected.")
        );
        if (status) {
          setResource<MetaStatus>(STATUS_KEY, () => status);
          invalidate(FORMS_KEY);
          onClose();
        }
      }}
      open
      submitDisabled={!valid}
      submitLabel="Connect"
      submitting={isPending("connect")}
      title="Connect a Facebook Page"
    >
      <Field hint="Numbers only." label="Page ID">
        <Input autoFocus inputMode="numeric" onChange={(event) => setPageId(event.target.value)} required value={pageId} />
      </Field>
      <Field hint="A System User token from Meta Business Settings, or a Page access token." label="Access token">
        <Input autoComplete="off" onChange={(event) => setAccessToken(event.target.value)} required type="password" value={accessToken} />
      </Field>
    </FormModal>
  );
}

function FormPicker({ status }: { status: Extract<MetaStatus, { connected: true }> }) {
  const { run, isPending } = useAction();
  const [allForms, setAllForms] = useState(status.formIds.length === 0);
  const [chosen, setChosen] = useState<string[]>(status.formIds);
  const forms = useResource<MetaForm[]>(allForms ? null : FORMS_KEY);

  // Back to what is saved whenever the saved choice changes.
  const savedIds = status.formIds.join();
  useEffect(() => {
    setAllForms(savedIds === "");
    setChosen(savedIds ? savedIds.split(",") : []);
  }, [savedIds]);

  const saved = allForms ? status.formIds.length === 0 : [...chosen].sort().join() === [...status.formIds].sort().join();
  const canSave = !saved && (allForms || chosen.length > 0);

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Lead forms to import</h3>
        <Btn
          disabled={!canSave}
          loading={isPending("forms")}
          onClick={() =>
            void run(
              "forms",
              async () => {
                const next = await crmFetch<MetaStatus>(FORMS_KEY, { method: "PUT", body: JSON.stringify({ formIds: allForms ? [] : chosen }) });
                setResource<MetaStatus>(STATUS_KEY, () => next);
              },
              "Lead forms saved."
            )
          }
          size="sm"
          variant="primary"
        >
          Save
        </Btn>
      </div>
      <div className="mt-2 space-y-2">
        <Checkbox checked={allForms} label="Every form on the Page, including ones made later" onChange={setAllForms} />
        {allForms ? null : forms.error ? (
          <ErrorBanner message={forms.error} onRetry={() => void forms.reload()} />
        ) : forms.isLoading && !forms.data ? (
          <p className="text-sm text-slate-500">Loading forms from Meta…</p>
        ) : forms.data?.length ? (
          <div className="grid gap-1.5 pl-6 sm:grid-cols-2">
            {forms.data.map((form) => (
              <Checkbox
                checked={chosen.includes(form.id)}
                key={form.id}
                label={
                  <span>
                    {form.name}
                    <span className="text-xs text-slate-500">
                      {form.status !== "ACTIVE" ? ` · ${form.status.toLowerCase()}` : ""}
                      {form.leadsCount !== null ? ` · ${form.leadsCount} lead${form.leadsCount === 1 ? "" : "s"}` : ""}
                    </span>
                  </span>
                }
                onChange={(on) => setChosen((current) => (on ? [...current, form.id] : current.filter((id) => id !== form.id)))}
              />
            ))}
          </div>
        ) : (
          <p className="pl-6 text-sm text-slate-500">This Page has no lead forms yet.</p>
        )}
      </div>
    </div>
  );
}
