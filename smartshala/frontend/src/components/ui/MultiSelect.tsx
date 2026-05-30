"use client";

import { useEffect, useRef, useState } from "react";

type MultiSelectOption = {
  label: string;
  value: string;
};

type MultiSelectProps = {
  label: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  className?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function MultiSelect({ label, options, values, onChange, className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className={cx("relative inline-block min-w-0", className)} ref={rootRef}>
      <button
        ref={buttonRef}
        className="inline-flex min-h-10 items-center justify-between gap-2 rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[13px] font-semibold text-[#1d1d1f] hover:border-[#8C96A3] transition-colors"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className="truncate">{label}</span>
        {values.length > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2456E6]/10 text-[11px] font-bold text-[#2456E6]">
            {values.length}
          </span>
        )}
        <svg className={`h-3.5 w-3.5 shrink-0 text-[#5A6573] transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[200] w-[240px] rounded-[8px] border border-[#DCE1E8] bg-white p-2 text-[#1d1d1f] shadow-[var(--shadow-menu)]">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-[#EEF1F5] pb-2">
            <span className="text-[12px] font-semibold text-[#5A6573]">{label}</span>
            {values.length > 0 && (
              <button
                className="text-[12px] font-semibold text-[#2456E6] hover:underline"
                onClick={() => onChange([])}
                type="button"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {options.length === 0 ? (
              <div className="p-2 text-center text-[12px] text-[#86868b]">No options</div>
            ) : (
              options.map((option) => {
                const checked = values.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex min-h-9 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[13px] font-medium hover:bg-[#F7F8FB]"
                  >
                    <span
                      className={cx(
                        "flex h-4 w-4 items-center justify-center rounded-[4px] border text-[10px]",
                        checked ? "border-[#2456E6] bg-[#2456E6] text-white" : "border-[#A7B0BD] bg-white"
                      )}
                    >
                      {checked && <span>&#10003;</span>}
                    </span>
                    <input
                      checked={checked}
                      className="sr-only"
                      onChange={() => {
                        if (checked) {
                          onChange(values.filter((v) => v !== option.value));
                        } else {
                          onChange([...values, option.value]);
                        }
                      }}
                      type="checkbox"
                    />
                    <span className="truncate">{option.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
