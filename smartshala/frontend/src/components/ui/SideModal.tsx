"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type SideModalProps = {
  children: ReactNode;
  eyebrow?: string;
  onClose: () => void;
  title: string;
  width?: "md" | "lg";
};

const widthClasses = {
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl"
};

export function SideModal({ children, eyebrow, onClose, title, width = "md" }: SideModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/35 backdrop-blur-[2px] side-modal-overlay" role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default" aria-label="Close panel" onClick={onClose} type="button" />
      <aside className={`relative flex h-full w-full ${widthClasses[width]} flex-col overflow-hidden bg-white shadow-[var(--shadow-modal)] side-modal-panel`}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-200)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">{eyebrow}</p> : null}
            <h1 className="mt-1 text-[22px] font-bold leading-7 tracking-normal text-[#0F1419]">{title}</h1>
          </div>
          <button
            aria-label="Close panel"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#5A6573] transition-colors hover:bg-[#F7F8FB] hover:text-[#0F1419]"
            onClick={onClose}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </aside>
    </div>,
    document.body
  );
}
