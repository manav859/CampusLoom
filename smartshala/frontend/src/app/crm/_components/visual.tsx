import { cx } from "../../super-admin/_components/ui";

/** Outline icons (24px grid) for the deals board and the deal page. */
export const GLYPHS = {
  note: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11.8 15H9v-2.8l8.6-8.6z",
  call: "M3 5a2 2 0 012-2h3.3a1 1 0 01.9.7l1.5 4.5a1 1 0 01-.5 1.2l-2.3 1.1a11 11 0 005.5 5.5l1.1-2.3a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.7.9V19a2 2 0 01-2 2h-1C9.7 21 3 14.3 3 6V5z",
  chat: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.4-4 8-9 8a9.9 9.9 0 01-4.3-1L3 20l1.4-3.7A7.4 7.4 0 013 12c0-4.4 4-8 9-8s9 3.6 9 8z",
  email: "M3 8l7.9 5.3a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  flag: "M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  card: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  edit: "M15.2 5.2l3.5 3.5M16.7 3.7a2.5 2.5 0 113.5 3.5L6.5 21H3v-3.6L16.7 3.7z",
  check: "M5 13l4 4L19 7",
  alert: "M12 9v2m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  table: "M3 10h18M3 14h18M10 3v18M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z",
  board: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v12h-4z",
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  chevron: "M19 9l-7 7-7-7"
} as const;

export function Glyph({ name, className }: { name: keyof typeof GLYPHS; className?: string }) {
  return (
    <svg aria-hidden="true" className={cx("h-4 w-4 shrink-0", className)} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d={GLYPHS[name]} />
    </svg>
  );
}

/** Two-letter avatar; a dashed circle when nobody is named. */
export function Initials({ name, size = "sm" }: { name: string | null | undefined; size?: "sm" | "lg" }) {
  const letters = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        size === "lg" ? "h-12 w-12 text-sm" : "h-5 w-5 text-[9px]",
        letters ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100" : "border border-dashed border-slate-300 text-slate-400"
      )}
    >
      {letters || "?"}
    </span>
  );
}
