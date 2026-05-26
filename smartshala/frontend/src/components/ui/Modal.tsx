"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

type ModalProps = {
  children: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  fullScreen?: boolean;
  isOpen: boolean;
  onClose: () => void;
  size?: "md" | "lg" | "xl";
  title: ReactNode;
};

const sizeClasses = {
  md: "max-w-md",
  lg: "max-w-3xl",
  xl: "max-w-6xl"
};

export function Modal({ children, description, footer, fullScreen = false, isOpen, onClose, size = "md", title }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className={`fixed left-0 top-0 z-[200] flex h-[100dvh] w-[100vw] overflow-hidden bg-black/40 backdrop-blur-sm ${fullScreen ? "items-stretch justify-stretch p-0" : "items-center justify-center px-3 py-4 sm:px-4"}`} role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default" aria-label="Close modal" onClick={onClose} type="button" />
      <div className={`relative flex flex-col overflow-hidden bg-white shadow-[var(--shadow-modal)] ${fullScreen ? "h-[100dvh] max-h-[100dvh] w-[100vw] max-w-none rounded-none" : `w-full max-h-[calc(100dvh-2rem)] rounded-[var(--radius-xl)] ${sizeClasses[size]}`}`}>
        <button
          aria-label="Close modal"
          className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DCE1E8] bg-white text-[#52687D] shadow-[0_4px_16px_rgba(15,20,25,0.14)] transition hover:bg-[#F7F8FB] hover:text-[#031526]"
          onClick={onClose}
          type="button"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div className="shrink-0 border-b border-[var(--border-200)] px-5 py-4 pr-14 sm:px-6 sm:py-5 sm:pr-16">
          <h2 className="text-[20px] font-semibold text-[var(--ink-900)]">{title}</h2>
          {description ? <div className="mt-2 text-[13px] leading-5 text-[var(--ink-500)]">{description}</div> : null}
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border-200)] bg-[var(--surface-50)] px-5 py-4 sm:px-6">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export function ModalCloseButton({ children = "Cancel", onClick }: { children?: ReactNode; onClick: () => void }) {
  return (
    <Button onClick={onClick} variant="secondary">
      {children}
    </Button>
  );
}
