import Link from "next/link";
import type { NotificationLog } from "@/lib/api";

function countByStatus(logs: NotificationLog[], status: NotificationLog["status"]) {
  return logs.filter((log) => log.status === status).length;
}

export function WhatsAppWidget({ logs, loading }: { logs: NotificationLog[]; loading?: boolean }) {
  const sent = countByStatus(logs, "SENT");
  const failed = countByStatus(logs, "FAILED");
  const queued = countByStatus(logs, "QUEUED");

  return (
    <section className="glass-card-interactive p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">WhatsApp activity</h2>
          <p className="mt-0.5 text-[13px] text-[#86868b]">Latest parent communication status.</p>
        </div>
        <Link className="text-[13px] font-medium text-[#0071e3] hover:text-[#0077ed] transition-colors" href="/notifications">View all →</Link>
      </div>
      {loading ? (
        <p className="mt-5 rounded-xl bg-[rgba(0,0,0,0.02)] px-4 py-4 text-[13px] text-[#86868b]">Loading WhatsApp logs…</p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="kpi-metric-card kpi-metric-card-good p-4">
            <p className="kpi-metric-label">Sent</p>
            <p className="kpi-metric-value">{sent}</p>
          </div>
          <div className="kpi-metric-card kpi-metric-card-warn p-4">
            <p className="kpi-metric-label">Queued</p>
            <p className="kpi-metric-value">{queued}</p>
          </div>
          <div className="kpi-metric-card kpi-metric-card-danger p-4">
            <p className="kpi-metric-label">Failed</p>
            <p className="kpi-metric-value">{failed}</p>
          </div>
        </div>
      )}
    </section>
  );
}
