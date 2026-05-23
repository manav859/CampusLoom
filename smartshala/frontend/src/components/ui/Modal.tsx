"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "./Button";

type ModalProps = {
  children: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
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

export function Modal({ children, description, footer, isOpen, onClose, size = "md", title }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-3 py-4 backdrop-blur-sm sm:px-4" role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default" aria-label="Close modal" onClick={onClose} type="button" />
      <div className={`relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-[var(--radius-xl)] bg-white shadow-[var(--shadow-modal)] ${sizeClasses[size]}`}>
        <div className="shrink-0 border-b border-[var(--border-200)] px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[20px] font-semibold text-[var(--ink-900)]">{title}</h2>
          {description ? <div className="mt-2 text-[13px] leading-5 text-[var(--ink-500)]">{description}</div> : null}
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border-200)] bg-[var(--surface-50)] px-5 py-4 sm:px-6">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ModalCloseButton({ children = "Cancel", onClick }: { children?: ReactNode; onClick: () => void }) {
  return (
    <Button onClick={onClick} variant="secondary">
      {children}
    </Button>
  );
}
