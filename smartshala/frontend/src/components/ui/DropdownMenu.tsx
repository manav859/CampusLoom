"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

type DropdownMenuProps = {
  children: ReactNode;
  label: ReactNode;
};

export function DropdownMenu({ children, label }: DropdownMenuProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function closeForOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeForOtherMenu(event: Event) {
      if ((event as CustomEvent<string>).detail !== menuId) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeForOutsideClick);
    window.addEventListener("smartshala-dropdown-open", closeForOtherMenu);
    return () => {
      document.removeEventListener("mousedown", closeForOutsideClick);
      window.removeEventListener("smartshala-dropdown-open", closeForOtherMenu);
    };
  }, [menuId]);

  function toggleMenu() {
    setOpen((current) => {
      const next = !current;
      if (next) window.dispatchEvent(new CustomEvent("smartshala-dropdown-open", { detail: menuId }));
      return next;
    });
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        aria-expanded={open}
        className="inline-flex min-h-9 cursor-pointer list-none items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-200)] bg-white px-3 text-[13px] font-semibold text-[var(--ink-900)] hover:bg-[var(--surface-50)] focus:outline-none focus:ring-2 focus:ring-[color:rgb(36_86_230/40%)]"
        onClick={toggleMenu}
        type="button"
      >
        {label}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 min-w-[180px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-200)] bg-white py-1 shadow-[var(--shadow-menu)]" onClick={() => setOpen(false)}>
          {children}
        </div>
      ) : null}
    </div>
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
