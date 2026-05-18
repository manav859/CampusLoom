"use client";

import type { InvalidEvent, ReactNode } from "react";

type FormSectionProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  title: string;
};

export function FormSection({ children, defaultOpen = false, title }: FormSectionProps) {
  return (
    <details className="form-section" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <svg className="h-4 w-4 transition-transform duration-200" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="form-section-body">{children}</div>
    </details>
  );
}

export function openInvalidFormSection(event: InvalidEvent<HTMLFormElement>) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  target.closest("details")?.setAttribute("open", "");
}
