"use client";

import { useState, useEffect, useRef } from "react";

type Notification = {
  id: string;
  icon: "absence" | "payment" | "alert";
  message: string;
  time: string;
  type: "URGENT" | "PAYMENT" | "ALERT" | "INFO";
};

const mockNotifications: Notification[] = [
  { id: "1", icon: "absence", message: "Rohit Sharma absent 5 days", time: "8:45 AM", type: "URGENT" },
  { id: "2", icon: "payment", message: "₹36,000 received — Rohan Shah", time: "9:02 AM", type: "PAYMENT" },
  { id: "3", icon: "alert", message: "Class 6C: 68% attendance", time: "9:15 AM", type: "ALERT" },
  { id: "4", icon: "payment", message: "₹12,000 received — Sneha Joshi", time: "9:30 AM", type: "PAYMENT" },
  { id: "5", icon: "absence", message: "Arjun Mehta absent 3 days", time: "9:45 AM", type: "URGENT" },
  { id: "6", icon: "alert", message: "Class 10B: 72% attendance", time: "10:00 AM", type: "ALERT" },
];

const typeStyles: Record<string, { bg: string; text: string }> = {
  URGENT:  { bg: "bg-[#ff3b30]", text: "text-white" },
  PAYMENT: { bg: "bg-[#34c759]", text: "text-white" },
  ALERT:   { bg: "bg-[#ff9500]", text: "text-white" },
  INFO:    { bg: "bg-[#0071e3]", text: "text-white" },
};

const iconMap: Record<string, React.ReactNode> = {
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    </div>
  ),
  alert: (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff9500]/10">
      <svg className="h-4 w-4 text-[#ff9500]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    </div>
  ),
};

export function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[200] bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 z-[201] h-full w-full max-w-[400px] bg-white/95 backdrop-blur-xl shadow-[-8px_0_32px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[rgba(0,0,0,0.06)] px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff3b30] to-[#ff9500]">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <h2 className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Notifications</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#f5f5f7] transition-colors"
          >
            <svg className="h-4 w-4 text-[#86868b]" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto h-[calc(100%-73px)] px-4 py-3">
          <p className="px-2 mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">Today</p>
          <div className="space-y-1">
            {mockNotifications.map((n) => {
              const style = typeStyles[n.type];
              return (
                <div
                  key={n.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#f5f5f7]/80 transition-colors cursor-pointer group"
                >
                  {iconMap[n.icon]}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1d1d1f] truncate">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-[11px] text-[#86868b] font-medium">{n.time}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${style.bg} ${style.text}`}>
                      {n.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
