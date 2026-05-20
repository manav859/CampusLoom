"use client";

export type ActivityEvent = {
  id: string;
  text: string;
  time: string;
  type: "attendance" | "fee" | "alert" | "message";
};

const typeIcon: Record<ActivityEvent["type"], { color: string; bg: string }> = {
  attendance: { color: "#0071e3", bg: "rgba(0,113,227,0.08)" },
  fee: { color: "#34c759", bg: "rgba(52,199,89,0.08)" },
  alert: { color: "#ff3b30", bg: "rgba(255,59,48,0.08)" },
  message: { color: "#ff9500", bg: "rgba(255,149,0,0.08)" },
};

export function ActivityFeed({ events }: { events?: ActivityEvent[] }) {
  const items = events ?? [];

  return (
    <div className="glass-card-interactive flex h-[360px] flex-col p-5">
      <div className="mb-3 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#86868b]">Activity</p>
        <h3 className="mt-0.5 text-[15px] font-semibold text-[#1d1d1f]">Recent events</h3>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
        {items.length === 0 ? (
          <div className="rounded-lg px-3 py-8 text-center text-[13px] font-medium text-[#86868b]">
            No recent activity yet.
          </div>
        ) : (
          items.map((ev) => {
            const style = typeIcon[ev.type];
            return (
              <div key={ev.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#f5f5f7]">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: style.bg }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-[13px] font-semibold leading-5 text-[#1d1d1f]">{ev.text}</p>
                  <p className="mt-0.5 text-[11px] text-[#86868b]">{ev.time}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
