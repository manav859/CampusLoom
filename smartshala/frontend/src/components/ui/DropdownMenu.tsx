import type { ReactNode } from "react";

type DropdownMenuProps = {
  children: ReactNode;
  label: ReactNode;
};

export function DropdownMenu({ children, label }: DropdownMenuProps) {
  return (
    <details className="relative inline-block">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-200)] bg-white px-3 text-[13px] font-semibold text-[var(--ink-900)] hover:bg-[var(--surface-50)] focus:outline-none focus:ring-2 focus:ring-[color:rgb(36_86_230/40%)]">
        {label}
      </summary>
      <div className="absolute right-0 z-20 mt-2 min-w-[180px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-200)] bg-white py-1 shadow-[var(--shadow-menu)]">
        {children}
      </div>
    </details>
  );
}

export function DropdownItem({ children, destructive = false, onClick }: { children: ReactNode; destructive?: boolean; onClick?: () => void }) {
  return (
    <button
      className={`block w-full px-3 py-2 text-left text-[12px] font-semibold hover:bg-[var(--surface-50)] ${destructive ? "text-[var(--danger-600)]" : "text-[var(--ink-900)]"}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
