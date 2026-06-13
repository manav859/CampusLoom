import Link from "next/link";

type AlertItem = {
  actionLabel?: string;
  disabled?: boolean;
  label: string;
  detail?: string;
  onAction?: () => void;
  severity?: "critical" | "high" | "medium";
  tone?: "danger" | "warn" | "neutral";
  href?: string;
};

const severityStyles = {
  critical: "bg-[#ff3b30]/10 text-[#d70015] border border-[#ff3b30]/15",
  high: "bg-[#ff9500]/10 text-[#c93400] border border-[#ff9500]/15",
  medium: "bg-[#86868b]/10 text-[#424245] border border-[#86868b]/15"
};

const severityLabels = {
  critical: "Critical",
  high: "High",
  medium: "Medium"
};

const toneStyles = {
  danger: {
    card: "border-[#ff3b30]/12 hover:border-[#ff3b30]/30 hover:bg-[#ff3b30]/[0.03]",
    iconBg: "bg-[#ff3b30]/10",
    iconColor: "text-[#d70015]",
    dot: "#ff3b30",
    icon: "M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
  },
  warn: {
    card: "border-[#ff9500]/12 hover:border-[#ff9500]/30 hover:bg-[#ff9500]/[0.03]",
    iconBg: "bg-[#ff9500]/10",
    iconColor: "text-[#c93400]",
    dot: "#ff9500",
    icon: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
  },
  neutral: {
    card: "border-[#86868b]/12 hover:border-[#86868b]/30 hover:bg-[#86868b]/[0.03]",
    iconBg: "bg-[#86868b]/10",
    iconColor: "text-[#424245]",
    dot: "#86868b",
    icon: "M12 16v-4m0-4h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"
  }
};

export function AlertPanel({ alerts, loading }: { alerts: AlertItem[]; loading?: boolean }) {
  return (
    <section className="dashboard-panel-card flex min-h-[280px] max-h-[420px] flex-col overflow-hidden p-4 sm:h-[360px] sm:p-6">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Today&apos;s Actions</h2>
          <p className="mt-0.5 text-[13px] text-[#86868b]">Priority follow-ups across attendance and fees.</p>
        </div>
        <Link className="shrink-0 text-[13px] font-medium text-[#0071e3] transition-colors hover:text-[#0077ed]" href="/notifications">Logs -&gt;</Link>
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-2">
        {loading ? (
          <p className="rounded-xl bg-[rgba(0,0,0,0.02)] px-4 py-4 text-[13px] text-[#86868b]">Loading actions...</p>
        ) : alerts.length === 0 ? (
          <p className="rounded-xl bg-[#34c759]/[0.06] px-4 py-4 text-[13px] font-medium text-[#248a3d]">No urgent actions right now.</p>
        ) : (
          alerts.map((alert, index) => {
            const tone = alert.tone ?? "neutral";
            const currentTone = toneStyles[tone];
            const isClickable = !!alert.href;

            const content = (
              <div className={`flex items-start gap-3 rounded-[12px] border bg-white px-3 py-3 transition-all duration-200 sm:items-center sm:gap-3.5 sm:px-3.5 ${currentTone.card}`}>
                <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${currentTone.iconBg} ${currentTone.iconColor}`}>
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={currentTone.icon} />
                  </svg>
                  {alert.severity === "critical" ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: currentTone.dot }} />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ backgroundColor: currentTone.dot }} />
                    </span>
                  ) : null}
                </span>

                <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                      <p className="min-w-0 text-[13px] font-semibold leading-tight text-[#1d1d1f] tracking-tight sm:text-[13.5px] line-clamp-2 sm:truncate sm:line-clamp-none">{alert.label}</p>
                      {alert.severity ? (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${severityStyles[alert.severity]}`}>
                          {severityLabels[alert.severity]}
                        </span>
                      ) : null}
                    </div>
                    {alert.detail ? (
                      <p className="mt-0.5 text-[11px] font-medium text-[#5a6573] line-clamp-1 sm:text-[12px]">{alert.detail}</p>
                    ) : null}
                  </div>

                <div className="flex shrink-0 items-center justify-end gap-2">
                  {alert.actionLabel && alert.onAction ? (
                    <button
                      className="whitespace-nowrap rounded-lg bg-[#2456E6]/[0.08] hover:bg-[#2456E6] text-[#2456E6] hover:text-white px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5 sm:py-1.5 sm:text-[11.5px]"
                      disabled={alert.disabled}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        alert.onAction?.();
                      }}
                      type="button"
                    >
                      {alert.actionLabel}
                    </button>
                  ) : alert.href ? (
                    <svg
                      className="h-4 w-4 text-neutral-400 transition-transform duration-200 group-hover:translate-x-1 sm:h-4.5 sm:w-4.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  ) : null}
                </div>
              </div>
            );

            if (isClickable && alert.href) {
              return (
                <Link
                  key={`${alert.label}-${index}`}
                  href={alert.href}
                  className="group block no-underline focus:outline-none focus-ring rounded-xl"
                >
                  {content}
                </Link>
              );
            }

            return <div key={`${alert.label}-${index}`}>{content}</div>;
          })
        )}
      </div>
    </section>
  );
}
