"use client";

import { useEffect, useRef, useState } from "react";

type CustomSelectOption = {
  label: string;
  value: string;
};

type CustomSelectProps = {
  ariaLabel: string;
  className?: string;
  menuClassName?: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  value: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function CustomSelect({ ariaLabel, className, menuClassName, onChange, options, value }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={cx(
          "inline-flex h-9 min-w-0 items-center justify-between gap-2 rounded-[6px] border border-[#DCE1E8] bg-white px-3 text-[12px] font-semibold text-[#1d1d1f] shadow-[0_1px_2px_rgba(15,20,25,0.06)] transition-colors hover:border-[#8C96A3] hover:bg-[#F7F8FB]",
          className
        )}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 truncate">{selected?.label}</span>
        <svg className={`h-3.5 w-3.5 shrink-0 text-[#5A6573] transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>

      {open ? (
        <div
          className={cx(
            "absolute right-0 z-[130] mt-2 max-h-64 min-w-full overflow-y-auto rounded-[8px] border border-[#DCE1E8] bg-white p-1 shadow-[0_12px_32px_-12px_rgba(15,20,25,0.35)]",
            menuClassName
          )}
          role="listbox"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                aria-selected={active}
                className={cx(
                  "flex w-full items-center justify-between gap-3 rounded-[6px] px-3 py-2 text-left text-[12px] font-semibold transition-colors",
                  active ? "bg-[#2456E6] text-white" : "text-[#2A3340] hover:bg-[#F7F8FB]"
                )}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role="option"
                type="button"
              >
                <span className="whitespace-nowrap">{option.label}</span>
                {active ? (
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
                    <path d="m5 13 4 4L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
