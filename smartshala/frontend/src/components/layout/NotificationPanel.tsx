"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { NotificationLog } from "@/lib/api";

type PanelNotification = {
  href: string;
  id: string;
  icon: "absence" | "payment" | "alert";
  message: string;
  time: string;
  type: "URGENT" | "PAYMENT" | "ALERT" | "INFO";
};

function formatTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(value));
}

function hrefForLog(log: NotificationLog) {
  if ((log.kind === "FEE_REMINDER" || log.kind === "OVERDUE_FEE" || log.kind === "PAYMENT_RECEIPT") && log.student?.id) {
    return `/fees/${log.student.id}`;
  }

  if ((log.kind === "LOW_ATTENDANCE" || log.kind === "ABSENCE") && log.student?.id) {
    return `/students/${log.student.id}`;
  }

  if (log.kind === "LOW_ATTENDANCE") return "/analytics";
  if (log.kind === "FEE_REMINDER" || log.kind === "OVERDUE_FEE") return "/fees/defaulters";
  if (log.kind === "MONTHLY_REPORT") return "/reports";
  return "/notifications";
}

function mapLog(log: NotificationLog): PanelNotification {
  const isAttendance = log.kind === "ABSENCE" || log.kind === "LOW_ATTENDANCE";
  const isPayment = log.kind === "PAYMENT_RECEIPT";
  const isFeeAlert = log.kind === "FEE_REMINDER" || log.kind === "OVERDUE_FEE";

  return {
    href: hrefForLog(log),
    id: log.id,
    icon: isAttendance ? "absence" : isPayment ? "payment" : "alert",
    message: log.student?.fullName ? `${log.student.fullName}: ${log.message}` : log.message,
    time: formatTime(log.sentAt ?? log.createdAt),
    type: log.status === "FAILED" || isAttendance ? "URGENT" : isPayment ? "PAYMENT" : isFeeAlert ? "ALERT" : "INFO"
  };
}

export function isPrincipalNotification(log: NotificationLog) {
  if (log.kind === "ABSENCE" || log.kind === "PAYMENT_RECEIPT") return false;
  if (log.status === "FAILED") return true;
  return ["LOW_ATTENDANCE", "FEE_REMINDER", "OVERDUE_FEE", "SCHOOL_ALERT", "MONTHLY_REPORT"].includes(log.kind);
}

const typeStyles: Record<PanelNotification["type"], { bg: string; text: string }> = {
  URGENT: { bg: "bg-[#ff3b30]", text: "text-white" },
  PAYMENT: { bg: "bg-[#34c759]", text: "text-white" },
  ALERT: { bg: "bg-[#ff9500]", text: "text-white" },
  INFO: { bg: "bg-[#0071e3]", text: "text-white" },
};

const iconMap: Record<PanelNotification["icon"], React.ReactNode> = {
  absence: (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff3b30]/10">
      <svg className="h-4 w-4 text-[#ff3b30]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    </div>
  ),
  payment: (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#34c759]/10">
      <svg className="h-4 w-4 text-[#34c759]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5m-18 3h19.5m-18 8.25h19.5M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
  ),
  alert: (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff9500]/10">
      <svg className="h-4 w-4 text-[#ff9500]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    </div>
  ),
};

export function NotificationPanel({
  open,
  onClose,
  logs,
  loading = false,
  onClear,
  onDelete
}: {
  open: boolean;
  onClose: () => void;
  logs: NotificationLog[];
  loading?: boolean;
  onClear?: () => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ message: string; x: number; y: number } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const notifications = logs.filter(isPrincipalNotification).slice(0, 20).map(mapLog);

  function showTooltip(event: MouseEvent<HTMLElement>, message: string) {
    setTooltip({ message, x: event.clientX, y: event.clientY });
  }

  async function clearAll() {
    if (!onClear) return;
    setClearing(true);
    try {
      await onClear();
      setTooltip(null);
    } finally {
      setClearing(false);
    }
  }

  async function deleteOne(id: string) {
    if (!onDelete) return;
    setDeletingId(id);
    try {
      await onDelete(id);
      setTooltip(null);
    } finally {
      setDeletingId("");
    }
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-[200] bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={`fixed right-0 top-0 z-[201] h-full w-full max-w-[400px] bg-white/95 backdrop-blur-xl shadow-[-8px_0_32px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-[rgba(0,0,0,0.06)] px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff3b30] to-[#ff9500]">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <h2 className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Notifications</h2>
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 ? (
              <button
                className="rounded-lg border border-[#D6DCE5] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#D92D20] transition hover:bg-[#FFF1F0] disabled:opacity-50"
                disabled={clearing}
                onClick={clearAll}
                type="button"
              >
                {clearing ? "Clearing..." : "Clear all"}
              </button>
            ) : null}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#f5f5f7] transition-colors"
              type="button"
            >
              <svg className="h-4 w-4 text-[#86868b]" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(100%-73px)] px-4 py-3">
          <p className="px-2 mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">Recent</p>
          <div className="space-y-1">
            {loading ? (
              <div className="px-3 py-8 text-center text-[13px] font-medium text-[#86868b]">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="px-3 py-8 text-center text-[13px] font-medium text-[#86868b]">No important notifications yet.</div>
            ) : (
              notifications.map((n) => {
                const style = typeStyles[n.type];
                return (
                  <div
                    key={n.id}
                    className="group flex items-center gap-2 rounded-xl px-3 py-3 transition-colors hover:bg-[#f5f5f7]/80"
                    onMouseEnter={(event) => showTooltip(event, n.message)}
                    onMouseLeave={() => setTooltip(null)}
                    onMouseMove={(event) => showTooltip(event, n.message)}
                  >
                    <Link className="flex min-w-0 flex-1 items-center gap-3" href={n.href} onClick={onClose}>
                      {iconMap[n.icon]}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[#1d1d1f]">{n.message}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <span className="text-[11px] text-[#86868b] font-medium">{n.time}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${style.bg} ${style.text}`}>
                          {n.type}
                        </span>
                      </div>
                    </Link>
                    <button
                      aria-label="Delete notification"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#A0A7B2] opacity-0 transition hover:bg-[#FFF1F0] hover:text-[#D92D20] group-hover:opacity-100 disabled:opacity-50"
                      disabled={deletingId === n.id}
                      onClick={() => deleteOne(n.id)}
                      type="button"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M10 11v6M14 11v6M9 7l1-2h4l1 2M8 7l1 13h6l1-13" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      {tooltip ? (() => {
        const width = Math.min(420, window.innerWidth - 32);
        const height = Math.min(260, 74 + Math.ceil(tooltip.message.length / 42) * 22);
        const left = Math.min(Math.max(16, tooltip.x - width / 2), window.innerWidth - width - 16);
        const top = tooltip.y + height + 24 > window.innerHeight ? Math.max(16, tooltip.y - height - 18) : tooltip.y + 18;

        return (
          <div
            className="pointer-events-none fixed z-[230] max-h-[260px] overflow-y-auto rounded-[5px] bg-[#001827] px-4 py-3 text-[14px] font-semibold leading-6 text-white shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
            style={{ left, top, width }}
          >
            <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#001827]" />
            <span className="relative block whitespace-normal">{tooltip.message}</span>
          </div>
        );
      })() : null}
    </>
  );
}
