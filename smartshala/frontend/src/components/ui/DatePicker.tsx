"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { formatDateShort } from "@/lib/formatters";

type DatePickerProps = {
  buttonClassName?: string;
  disabled?: boolean;
  label?: string;
  max?: string;
  min?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
};

function todayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthFromValue(value: string) {
  return (value || todayInputValue()).slice(0, 7);
}

function monthInputFromParts(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

function calendarCells(month: string) {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  return [
    ...Array.from({ length: firstWeekday }, (_, index) => ({ key: `blank-${index}`, value: "" })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return { key: `${month}-${day}`, value: `${month}-${String(day).padStart(2, "0")}` };
    })
  ];
}

function isOutOfRange(value: string, min?: string, max?: string) {
  return Boolean((min && value < min) || (max && value > max));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function DatePicker({
  buttonClassName,
  disabled,
  label,
  max,
  min,
  onChange,
  placeholder = "Select date",
  required,
  value
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthFromValue(value));
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cells = useMemo(() => calendarCells(month), [month]);
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);

  const updatePopoverPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;

    const margin = 12;
    const rect = button.getBoundingClientRect();

    if (window.innerWidth < 640) {
      setPopoverStyle({ bottom: margin, left: margin, right: margin });
      return;
    }

    const width = Math.min(320, window.innerWidth - margin * 2);
    const estimatedHeight = 344;
    const left = clamp(rect.left, margin, window.innerWidth - width - margin);
    const preferredTop = rect.bottom + 8;
    const top = preferredTop + estimatedHeight > window.innerHeight
      ? clamp(rect.top - estimatedHeight - 8, margin, window.innerHeight - estimatedHeight - margin)
      : preferredTop;

    setPopoverStyle({ left, top, width });
  }, []);

  useEffect(() => {
    setMonth(monthFromValue(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updatePopoverPosition);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updatePopoverPosition);
    };
  }, [open, updatePopoverPosition]);

  const displayValue = value ? formatDateShort(value) : placeholder;

  return (
    <div className="relative" ref={wrapperRef}>
      {required ? <input aria-hidden="true" className="sr-only" onChange={() => undefined} required tabIndex={-1} value={value} /> : null}
      <button
        aria-expanded={open}
        className={buttonClassName ?? "glass-input flex min-h-10 w-full items-center justify-between gap-2 text-left text-[13px] font-semibold"}
        disabled={disabled}
        onClick={() => {
          updatePopoverPosition();
          setOpen((current) => !current);
        }}
        ref={buttonRef}
        type="button"
      >
        <span className="min-w-0">
          {label ? <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#86868b]">{label}</span> : null}
          <span className={`block truncate ${value ? "text-[#1d1d1f]" : "text-[#86868b]"}`}>{displayValue}</span>
        </span>
        <svg className="h-4 w-4 shrink-0 text-[#5A6573]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
        </svg>
      </button>

      {open ? (
        <div className="fixed z-[220] max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-[#DCE1E8] bg-white p-3 shadow-[var(--shadow-menu)]" style={popoverStyle}>
          <div className="mb-3 flex items-center justify-between">
            <button className="rounded-full p-2 text-[#5A6573] hover:bg-[#F7F8FB]" onClick={() => setMonth(monthInputFromParts(year, monthNumber - 2))} type="button" aria-label="Previous month">&lt;</button>
            <span className="text-[13px] font-bold text-[#1d1d1f]">{monthLabel(month)}</span>
            <button className="rounded-full p-2 text-[#5A6573] hover:bg-[#F7F8FB]" onClick={() => setMonth(monthInputFromParts(year, monthNumber))} type="button" aria-label="Next month">&gt;</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#86868b]">
            {["S", "M", "T", "W", "T", "F", "S"].map((weekday, index) => <span key={`${weekday}-${index}`}>{weekday}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              if (!cell.value) return <span aria-hidden="true" className="h-9" key={cell.key} />;
              const selected = value === cell.value;
              const outOfRange = isOutOfRange(cell.value, min, max);
              return (
                <button
                  className={`h-9 rounded-lg text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${selected ? "bg-[#2456E6] text-white" : "text-[#2A3340] hover:bg-[#F7F8FB]"}`}
                  disabled={outOfRange}
                  key={cell.key}
                  onClick={() => {
                    onChange(cell.value);
                    setOpen(false);
                  }}
                  type="button"
                >
                  {Number(cell.value.slice(8, 10))}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
