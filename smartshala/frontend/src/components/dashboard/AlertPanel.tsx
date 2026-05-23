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
    cardBg: "bg-gradient-to-r from-[#ff3b30]/[0.02] to-white hover:from-[#ff3b30]/[0.05] hover:to-white border-[#ff3b30]/10",
    borderLeft: "border-l-[#ff3b30]",
    dot: "#ff3b30"
  },
  warn: {
    cardBg: "bg-gradient-to-r from-[#ff9500]/[0.02] to-white hover:from-[#ff9500]/[0.05] hover:to-white border-[#ff9500]/10",
    borderLeft: "border-l-[#ff9500]",
    dot: "#ff9500"
  },
  neutral: {
    cardBg: "bg-gradient-to-r from-[#86868b]/[0.02] to-white hover:from-[#86868b]/[0.05] hover:to-white border-[#86868b]/10",
    borderLeft: "border-l-[#86868b]",
    dot: "#86868b"
  }
};

export function AlertPanel({ alerts, loading }: { alerts: AlertItem[]; loading?: boolean }) {
  return (
    <section className="dashboard-panel-card flex h-[360px] flex-col p-4 sm:p-6">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Today&apos;s actions</h2>
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
              <div className={`flex flex-col gap-3 rounded-[8px] border border-l-4 px-3.5 py-3.5 transition-all duration-300 shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 ${currentTone.cardBg} ${currentTone.borderLeft}`}>
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: currentTone.dot }} />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: currentTone.dot }} />
                  </span>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13.5px] font-semibold leading-tight text-[#1d1d1f] tracking-tight">{alert.label}</p>
                      {alert.severity ? (
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${severityStyles[alert.severity]}`}>
                          {severityLabels[alert.severity]}
                        </span>
                      ) : null}
                    </div>
                    {alert.detail ? (
                      <p className="mt-1 text-[12px] font-medium text-[#5a6573] line-clamp-1">{alert.detail}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                  {alert.actionLabel && alert.onAction ? (
                    <button
                      className="rounded-lg bg-[#2456E6]/[0.08] hover:bg-[#2456E6] text-[#2456E6] hover:text-white px-3.5 py-1.5 text-[11.5px] font-semibold transition-all duration-200 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="h-4.5 w-4.5 text-neutral-400 transition-transform duration-200 group-hover:translate-x-1"
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
