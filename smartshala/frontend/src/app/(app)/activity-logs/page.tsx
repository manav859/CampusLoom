"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { activityApi, type ActivityLog, type ActivityLogResponse } from "@/lib/api";
import { formatDateTimeShort, humanizeConstant } from "@/lib/formatters";

function actionTone(action: string) {
  if (action.includes("DELETE")) return "danger";
  if (action.includes("CREATE") || action.includes("RUN")) return "good";
  if (action.includes("UPDATE") || action.includes("REPLACE")) return "warn";
  return "neutral";
}

function stringifyJson(value: unknown) {
  if (!value) return "No details";
  return JSON.stringify(value, null, 2);
}

function actorLabel(log: ActivityLog) {
  if (!log.actor) return "System";
  return `${log.actor.fullName} (${humanizeConstant(log.actor.role)})`;
}

export default function ActivityLogsPage() {
  const [data, setData] = useState<ActivityLogResponse | null>(null);
  const [selected, setSelected] = useState<ActivityLog | null>(null);
  const [search, setSearch] = useState("");
  const [actorId, setActorId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    activityApi.logs({ action, actorId, entityType, page, search: search.trim() })
      .then((result) => {
        if (!active) return;
        setData(result);
        setSelected((current) => current ?? result.items[0] ?? null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load activity logs");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [action, actorId, entityType, page, search]);

  const topEntity = data?.stats.entityTypes[0];
  const topAction = data?.stats.actions[0];
  const stats = useMemo(
    () => [
      { label: "Total events", value: data?.stats.totalCount ?? 0 },
      { label: "Today", value: data?.stats.todayCount ?? 0 },
      { label: "Active actors", value: data?.stats.actorCount ?? 0 },
      { label: topEntity ? humanizeConstant(topEntity.label) : "Top module", value: topEntity?.count ?? 0 }
    ],
    [data, topEntity]
  );

  function resetFilters() {
    setSearch("");
    setActorId("");
    setEntityType("");
    setAction("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Audit trail" title="Activity logs" />

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div className="kpi-metric-card p-5" key={item.label}>
            <p className="kpi-metric-label">{item.label}</p>
            <p className="kpi-metric-value">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="glass-card-interactive p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px_auto]">
          <label className="block">
            <span className="text-[12px] font-semibold text-[#5A6573]">Search</span>
            <input
              className="glass-input mt-1.5"
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Search actor, action, module, summary"
              value={search}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-[#5A6573]">Actor</span>
            <select className="glass-input mt-1.5" onChange={(event) => { setPage(1); setActorId(event.target.value); }} value={actorId}>
              <option value="">All actors</option>
              {data?.filters.actors.map((actor) => (
                <option key={actor.id} value={actor.id}>{actor.fullName}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-[#5A6573]">Module</span>
            <select className="glass-input mt-1.5" onChange={(event) => { setPage(1); setEntityType(event.target.value); }} value={entityType}>
              <option value="">All modules</option>
              {data?.filters.entityTypes.map((type) => (
                <option key={type} value={type}>{humanizeConstant(type)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-[#5A6573]">Action</span>
            <select className="glass-input mt-1.5" onChange={(event) => { setPage(1); setAction(event.target.value); }} value={action}>
              <option value="">All actions</option>
              {data?.filters.actions.map((item) => (
                <option key={item} value={item}>{humanizeConstant(item)}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button className="btn-secondary min-h-[44px] w-full px-4 text-[13px]" onClick={resetFilters} type="button">Reset</button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
          <div className="flex items-center justify-between border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Full activity stream</h2>
              <p className="mt-0.5 text-[12px] font-medium text-[#86868b]">
                {loading ? "Loading..." : `${data?.meta.total ?? 0} events found`}
                {topAction ? ` - most common: ${humanizeConstant(topAction.label)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-secondary min-h-9 px-3 text-[12px]" disabled={!data || data.meta.page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Prev</button>
              <span className="text-[12px] font-semibold text-[#5A6573]">{data?.meta.page ?? page} / {data?.meta.totalPages ?? 1}</span>
              <button className="btn-secondary min-h-9 px-3 text-[12px]" disabled={!data || data.meta.page >= data.meta.totalPages || loading} onClick={() => setPage((value) => value + 1)} type="button">Next</button>
            </div>
          </div>

          <div className="divide-y divide-[rgba(0,0,0,0.05)]">
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <div className="animate-pulse px-5 py-4" key={index}>
                  <div className="h-4 w-48 rounded bg-[#f5f5f7]" />
                  <div className="mt-2 h-3 w-80 rounded bg-[#f5f5f7]" />
                </div>
              ))
            ) : data?.items.length === 0 ? (
              <div className="px-5 py-12 text-center text-[13px] font-medium text-[#86868b]">No activity logs found.</div>
            ) : (
              data?.items.map((log) => (
                <button
                  className={`block w-full px-5 py-4 text-left transition-colors hover:bg-[#F7F8FB] ${selected?.id === log.id ? "bg-[#E2F0FB]/70" : ""}`}
                  key={log.id}
                  onClick={() => setSelected(log)}
                  type="button"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill label={humanizeConstant(log.action)} tone={actionTone(log.action)} />
                        <span className="rounded-md bg-[#F7F8FB] px-2 py-1 text-[11px] font-semibold text-[#5A6573]">{humanizeConstant(log.entityType)}</span>
                        <span className="text-[12px] font-medium text-[#86868b]">{formatDateTimeShort(log.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-[14px] font-semibold text-[#1d1d1f]">{log.summary}</p>
                      <p className="mt-1 text-[12px] font-medium text-[#5A6573]">{actorLabel(log)}</p>
                    </div>
                    <code className="shrink-0 rounded-md bg-[#F7F8FB] px-2 py-1 text-[11px] font-semibold text-[#5A6573]">{log.entityId.slice(0, 8)}</code>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <aside className="sticky top-20 h-fit rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">Selected event</p>
                  <h2 className="mt-1 text-[17px] font-semibold text-[#1d1d1f]">{humanizeConstant(selected.entityType)}</h2>
                </div>
                <StatusPill label={humanizeConstant(selected.action)} tone={actionTone(selected.action)} />
              </div>
              <dl className="mt-5 space-y-3 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#86868b]">Actor</dt>
                  <dd className="text-right font-semibold text-[#1d1d1f]">{actorLabel(selected)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#86868b]">Time</dt>
                  <dd className="text-right font-semibold text-[#1d1d1f]">{formatDateTimeShort(selected.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#86868b]">Entity ID</dt>
                  <dd className="text-right font-code text-[12px] text-[#1d1d1f]">{selected.entityId}</dd>
                </div>
              </dl>
              <div className="mt-5 rounded-xl bg-[#F7F8FB] p-4">
                <p className="text-[12px] font-semibold text-[#5A6573]">Summary</p>
                <p className="mt-2 text-[13px] leading-6 text-[#1d1d1f]">{selected.summary}</p>
              </div>
              <div className="mt-4 space-y-3">
                <details className="rounded-xl border border-[#DCE1E8] bg-white p-4" open>
                  <summary className="cursor-pointer text-[12px] font-semibold text-[#1d1d1f]">After / request details</summary>
                  <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-[#0F1419] p-3 text-[11px] leading-5 text-white">{stringifyJson(selected.afterJson)}</pre>
                </details>
                <details className="rounded-xl border border-[#DCE1E8] bg-white p-4">
                  <summary className="cursor-pointer text-[12px] font-semibold text-[#1d1d1f]">Before details</summary>
                  <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-[#0F1419] p-3 text-[11px] leading-5 text-white">{stringifyJson(selected.beforeJson)}</pre>
                </details>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-[#F7F8FB] p-5 text-[13px] font-medium text-[#86868b]">Select an event to inspect full details.</div>
          )}
        </aside>
      </section>
    </div>
  );
}
