import React from "react";

export type EmptyStateProps = {
  icon?: React.ReactNode;
  headline: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon, headline, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-[rgba(0,0,0,0.1)] bg-[rgba(0,0,0,0.01)]">
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(0,0,0,0.04)] text-[#86868b]">
          {icon}
        </div>
      ) : (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(0,0,0,0.04)] text-[#86868b]">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
      )}
      <h3 className="text-[17px] font-semibold text-[#1d1d1f]">{headline}</h3>
      {description ? (
        <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-[#86868b]">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
