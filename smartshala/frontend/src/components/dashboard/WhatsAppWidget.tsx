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
          <div className="rounded-xl bg-[#34c759]/[0.08] p-4 border border-[#34c759]/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#248a3d]">Sent</p>
            <p className="mt-2 text-[28px] font-bold tracking-tight text-inherit">{sent}</p>
          </div>
          <div className="rounded-xl bg-[#ff9500]/[0.08] p-4 border border-[#ff9500]/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#c93400]">Queued</p>
            <p className="mt-2 text-[28px] font-bold tracking-tight text-inherit">{queued}</p>
          </div>
          <div className="rounded-xl bg-[#ff3b30]/[0.08] p-4 border border-[#ff3b30]/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#d70015]">Failed</p>
            <p className="mt-2 text-[28px] font-bold tracking-tight text-inherit">{failed}</p>
          </div>
        </div>
      )}
    </section>
  );
}
