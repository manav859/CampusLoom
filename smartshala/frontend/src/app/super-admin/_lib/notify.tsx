"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Notice = { id: number; kind: "success" | "error"; message: string };

type Notify = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const NotifyContext = createContext<Notify | null>(null);

/**
 * One place for "saved" and "that failed" messages across the portal. They
 * float in the corner instead of pushing the page down, and clear themselves.
 */
export function NotifyProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setNotices((current) => current.filter((notice) => notice.id !== id)), []);

  const push = useCallback(
    (kind: Notice["kind"], message: string) => {
      const id = nextId.current++;
      setNotices((current) => [...current.slice(-3), { id, kind, message }]);
      // Errors stay a little longer: they usually need reading.
      window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 3500);
    },
    [dismiss]
  );

  const value = useMemo<Notify>(
    () => ({ success: (message) => push("success", message), error: (message) => push("error", message) }),
    [push]
  );

  return (
    <NotifyContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-[min(92vw,380px)] flex-col gap-2">
        {notices.map((notice) => (
          <div
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium shadow-lg ${
              notice.kind === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"
            }`}
            key={notice.id}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            <span className="min-w-0 flex-1 break-words">{notice.message}</span>
            <button aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100" onClick={() => dismiss(notice.id)} type="button">
              ✕
            </button>
          </div>
        ))}
      </div>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  const context = useContext(NotifyContext);
  if (!context) throw new Error("useNotify must be used inside NotifyProvider");
  return context;
}
