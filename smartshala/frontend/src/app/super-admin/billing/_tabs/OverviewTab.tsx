"use client";

import { useState } from "react";
import Link from "next/link";
import { SUBSCRIPTION_STATUS, money, timeAgo, type Tone } from "../../_lib/format";
import { useResource } from "../../_lib/resource";
import type { Summary, SubscriptionStatus } from "../../_lib/types";
import { Btn, Card, CardHeader, ErrorBanner, Stat } from "../../_components/ui";
import type { BillingTab } from "../page";

const BAR: Record<Tone, string> = {
  good: "bg-green-500",
  info: "bg-blue-500",
  warn: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-slate-400"
};

const STATUS_ORDER: SubscriptionStatus[] = ["ACTIVE", "TRIALING", "PAST_DUE", "EXPIRED", "CANCELLED"];

/** The billing picture in plain words: what came in, what is owed, what needs doing. */
export function OverviewTab({ onNavigate }: { onNavigate: (tab: BillingTab) => void }) {
  const summary = useResource<Summary>("/billing/summary");
  const [showAll, setShowAll] = useState(false);
  const data = summary.data;

  if (summary.error) return <ErrorBanner message={summary.error} onRetry={() => void summary.reload()} />;
  if (!data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-[84px] animate-pulse rounded-lg border border-slate-200 bg-white" key={index} />
        ))}
      </div>
    );
  }

  const totalSchools = STATUS_ORDER.reduce((sum, status) => sum + (data.statusCounts[status] ?? 0), 0);
  const events = showAll ? data.recentEvents : data.recentEvents.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat hint={`${money(data.lifetimeCollectedMinor)} collected in total`} label="Collected this month" tone="good" value={money(data.collectedThisMonthMinor)} />
        <Stat
          hint={data.outstandingInvoiceCount ? `${data.outstandingInvoiceCount} unpaid invoice${data.outstandingInvoiceCount === 1 ? "" : "s"} — view them` : "Nothing owed"}
          label="Waiting to be paid"
          onClick={data.outstandingInvoiceCount ? () => onNavigate("invoices") : undefined}
          tone={data.outstandingInvoiceCount ? "warn" : "neutral"}
          value={money(data.outstandingMinor)}
        />
        <Stat
          hint={data.expiringSoon ? "Terms ending in the next 14 days" : "No terms ending in 14 days"}
          label="Renewals coming up"
          tone={data.expiringSoon ? "warn" : "neutral"}
          value={data.expiringSoon}
        />
        <Stat hint={`About ${money(data.arrMinor)} a year, from paying schools`} label="Expected monthly income" tone="info" value={money(data.mrrMinor)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader
            actions={
              <Link className="text-xs font-semibold text-blue-700 hover:underline" href="/super-admin/renewals">
                Go to renewals →
              </Link>
            }
            description={`${totalSchools} school${totalSchools === 1 ? "" : "s"} in total`}
            title="Schools by billing status"
          />
          <ul className="space-y-2.5 p-4">
            {STATUS_ORDER.map((status) => {
              const count = data.statusCounts[status] ?? 0;
              const meta = SUBSCRIPTION_STATUS[status];
              return (
                <li key={status}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{meta.label}</span>
                    <span className="font-semibold tabular-nums">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${BAR[meta.tone]}`} style={{ width: totalSchools ? `${(count / totalSchools) * 100}%` : 0 }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader description="Invoices, payments and changes, newest first" title="Recent activity" />
          <ul className="divide-y divide-slate-100">
            {events.map((event) => (
              <li className="flex items-start justify-between gap-3 px-4 py-2" key={event.id}>
                <p className="min-w-0 text-sm text-slate-800">{event.message}</p>
                <span className="shrink-0 whitespace-nowrap text-xs text-slate-500" title={new Date(event.createdAt).toLocaleString("en-IN")}>
                  {event.schoolId ? `${event.schoolId} · ` : ""}
                  {timeAgo(event.createdAt)}
                </span>
              </li>
            ))}
            {data.recentEvents.length === 0 ? <li className="px-4 py-3 text-sm text-slate-500">Nothing yet.</li> : null}
          </ul>
          {data.recentEvents.length > 8 ? (
            <div className="border-t border-slate-100 px-4 py-2">
              <Btn onClick={() => setShowAll((current) => !current)} size="sm" variant="ghost">
                {showAll ? "Show less" : `Show all ${data.recentEvents.length}`}
              </Btn>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
