"use client";

type ActivityEvent = {
  id: string;
  text: string;
  time: string;
  type: "attendance" | "fee" | "alert" | "message";
};

const defaultEvents: ActivityEvent[] = [
  { id: "1", text: "Class 6-A attendance marked", time: "10 min ago", type: "attendance" },
  { id: "2", text: "Rs 12,000 fee received — Aarav P.", time: "25 min ago", type: "fee" },
  { id: "3", text: "WhatsApp reminder sent to 8 parents", time: "1 hr ago", type: "message" },
  { id: "4", text: "Class 7-A attendance marked", time: "1.5 hr ago", type: "attendance" },
  { id: "5", text: "Fee overdue alert — Riya Patel", time: "2 hr ago", type: "alert" },
  { id: "6", text: "Rs 8,500 fee received — Kiran S.", time: "3 hr ago", type: "fee" },
];

const typeIcon: Record<ActivityEvent["type"], { color: string; bg: string }> = {
  attendance: { color: "#0071e3", bg: "rgba(0,113,227,0.08)" },
  fee: { color: "#34c759", bg: "rgba(52,199,89,0.08)" },
  alert: { color: "#ff3b30", bg: "rgba(255,59,48,0.08)" },
  message: { color: "#ff9500", bg: "rgba(255,149,0,0.08)" },
};

export function ActivityFeed({ events }: { events?: ActivityEvent[] }) {
  const items = events ?? defaultEvents;

  return (
    <div className="glass-card-interactive p-5 h-full flex flex-col">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#86868b]">Activity</p>
        <h3 className="mt-0.5 text-[15px] font-semibold text-[#1d1d1f]">Recent events</h3>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0 -mx-1 px-1">
        {items.map((ev) => {
          const style = typeIcon[ev.type];
          return (
            <div key={ev.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#f5f5f7]">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: style.bg }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#1d1d1f] leading-tight truncate">{ev.text}</p>
                <p className="mt-0.5 text-[11px] text-[#86868b]">{ev.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
