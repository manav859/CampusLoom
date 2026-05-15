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
  critical: "bg-[var(--danger-100)] text-[var(--danger-600)]",
  high: "bg-[var(--warning-100)] text-[var(--warning-600)]",
  medium: "bg-[#FFF9D8] text-[#7A5A00]"
};

const severityLabels = {
  critical: "Critical",
  high: "High",
  medium: "Medium"
};

const toneStyles = {
  danger: "bg-[#ff3b30]/[0.08] text-[#d70015] border border-[#ff3b30]/10",
  warn: "bg-[#ff9500]/[0.08] text-[#c93400] border border-[#ff9500]/10",
  neutral: "bg-[var(--apple-divider)] text-inherit border border-transparent"
};

const toneColors = {
  danger: "#ff3b30",
  warn: "#ff9500",
  neutral: "#d2d2d7"
};

export function AlertPanel({ alerts, loading }: { alerts: AlertItem[]; loading?: boolean }) {
  return (
    <section className="glass-card-interactive p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Today&apos;s actions</h2>
          <p className="mt-0.5 text-[13px] text-[#86868b]">Priority follow-ups across attendance and fees.</p>
        </div>
        <Link className="text-[13px] font-medium text-[#0071e3] hover:text-[#0077ed] transition-colors" href="/notifications">Logs →</Link>
      </div>
      <div className="mt-5 space-y-2">
        {loading ? (
          <p className="rounded-xl bg-[rgba(0,0,0,0.02)] px-4 py-4 text-[13px] text-[#86868b]">Loading actions…</p>
        ) : alerts.length === 0 ? (
          <p className="rounded-xl bg-[#34c759]/[0.06] px-4 py-4 text-[13px] font-medium text-[#248a3d]">No urgent actions right now.</p>
        ) : (
          alerts.map((alert, index) => {
            const tone = alert.tone ?? "neutral";
            const content = (
              <div className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3.5 transition-all duration-300 ease-apple hover:scale-[1.01] ${toneStyles[tone]}`}>
                <div className="flex min-w-0 items-start gap-3">
                <span className="indicator-dot mt-1.5 shrink-0" style={{ color: toneColors[tone], backgroundColor: toneColors[tone] }} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-bold tracking-tight">{alert.label}</p>
                    {alert.severity ? (
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${severityStyles[alert.severity]}`}>
                        {severityLabels[alert.severity]}
                      </span>
                    ) : null}
                  </div>
                  {alert.detail ? <p className="mt-0.5 text-[12px] opacity-70 font-medium">{alert.detail}</p> : null}
                </div>
                </div>
                {alert.actionLabel && alert.onAction ? (
                  <button
                    className="shrink-0 rounded-lg bg-white/70 px-3 py-1.5 text-[11px] font-bold text-[#2456E6] shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
                ) : null}
              </div>
            );

            if (alert.onAction) {
              return <div key={`${alert.label}-${index}`}>{content}</div>;
            }

            return alert.href ? <Link key={`${alert.label}-${index}`} href={alert.href}>{content}</Link> : <div key={`${alert.label}-${index}`}>{content}</div>;
          })
        )}
      </div>
    </section>
  );
}
