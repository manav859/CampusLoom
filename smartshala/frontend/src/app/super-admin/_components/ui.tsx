"use client";

import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes
} from "react";
import { CustomSelect, Modal } from "@/components/ui";
import type { Tone } from "../_lib/format";

/**
 * The super admin portal's building blocks. Every screen composes these, so
 * spacing, colour and behaviour stay the same everywhere and a change here
 * lands on every page at once. Deliberately compact: this is an operator's
 * console, not a marketing page.
 */

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// --- Page structure ------------------------------------------------------------

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      {/* The text block takes the slack, so a long description wraps instead of pushing the actions onto their own line. */}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("min-w-0 rounded-lg border border-slate-200 bg-white", className)}>{children}</section>;
}

export function CardHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mb-3 flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

// --- Buttons ---------------------------------------------------------------------

const BUTTON_VARIANTS = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  solidDanger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-blue-700 hover:bg-blue-50"
} as const;

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: "sm" | "md";
  loading?: boolean;
};

export function Btn({ variant = "secondary", size = "md", loading = false, disabled, className, children, type = "button", ...props }: BtnProps) {
  return (
    <button
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        BUTTON_VARIANTS[variant],
        className
      )}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent", className)} />;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Btn
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard is blocked outside a secure context; the text is on screen.
        }
      }}
      size="sm"
    >
      {copied ? "Copied ✓" : label}
    </Btn>
  );
}

// --- Status & numbers --------------------------------------------------------------

const TONES: Record<Tone, string> = {
  good: "bg-green-50 text-green-700 ring-green-600/20",
  info: "bg-blue-50 text-blue-700 ring-blue-600/20",
  warn: "bg-amber-50 text-amber-800 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/20"
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset", TONES[tone])}>
      {children}
    </span>
  );
}

const STAT_ACCENT: Record<Tone, string> = {
  good: "border-l-green-500",
  info: "border-l-blue-500",
  warn: "border-l-amber-500",
  danger: "border-l-red-500",
  neutral: "border-l-slate-300"
};

/** One number with a plain-language label and, optionally, what to do about it. */
export function Stat({ label, value, hint, tone = "neutral", onClick }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; onClick?: () => void }) {
  const body = (
    <>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </>
  );
  const className = cx("block w-full min-w-0 rounded-lg border border-l-4 border-slate-200 bg-white px-3.5 py-3 text-left", STAT_ACCENT[tone]);
  return onClick ? (
    <button className={cx(className, "transition-colors hover:bg-slate-50")} onClick={onClick} type="button">
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function KeyValue({ items, className }: { items: Array<[string, ReactNode]>; className?: string }) {
  return (
    <dl className={cx("grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4", className)}>
      {items.map(([label, content]) => (
        <div className="min-w-0" key={label}>
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">{content}</dd>
        </div>
      ))}
    </dl>
  );
}

// --- Forms -----------------------------------------------------------------------

export const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 disabled:bg-slate-50 disabled:text-slate-500";

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block min-w-0", className)}>
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputClass, "h-auto min-h-[72px] py-2", className)} {...props} />;
}

/** The app's shared dropdown, stretched to behave like a form input. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <CustomSelect
      ariaLabel={ariaLabel}
      className={cx("h-9 w-full text-sm font-medium", className)}
      onChange={(next) => onChange(next as T)}
      options={options}
      value={value}
      wrapperClassName="block w-full"
    />
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input checked={checked} className="h-4 w-4 rounded border-slate-300 accent-blue-600" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  );
}

// --- Tables ----------------------------------------------------------------------

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "right";
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty = "Nothing here yet.",
  onRowClick,
  minWidth = 640
}: {
  columns: Array<Column<T>>;
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  minWidth?: number;
}) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead className="table-head text-left text-[11px] uppercase tracking-wide">
          <tr>
            {columns.map((column) => (
              <th className={cx("whitespace-nowrap px-3 py-2.5 font-semibold", column.align === "right" && "text-right", column.className)} key={column.key}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && !rows
            ? Array.from({ length: 4 }).map((_, index) => (
                <tr className="border-t border-slate-100" key={index}>
                  {columns.map((column) => (
                    <td className="px-3 py-3" key={column.key}>
                      <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            : null}
          {rows?.map((row) => (
            <tr
              className={cx("border-t border-slate-100 align-middle", onRowClick && "cursor-pointer hover:bg-slate-50")}
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td className={cx("px-3 py-2.5", column.align === "right" && "text-right", column.className)} key={column.key}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows && rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** Action cells never trigger the row's own click. */
export function RowActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
      {children}
    </div>
  );
}

// --- Navigation --------------------------------------------------------------------

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: Array<{ id: T; label: string; count?: number }>; active: T; onChange: (id: T) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          className={cx(
            "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
            tab.id === active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
          )}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.label}
          {tab.count ? <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

// --- Feedback ----------------------------------------------------------------------

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <span>{message}</span>
      {onRetry ? (
        <Btn onClick={onRetry} size="sm">
          Try again
        </Btn>
      ) : null}
    </div>
  );
}

export function Callout({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={cx("rounded-md px-3 py-2 text-sm ring-1 ring-inset", TONES[tone])}>{children}</div>;
}

// --- Modals ------------------------------------------------------------------------

/**
 * A modal wrapping a real <form>: Enter submits, the primary button shows the
 * pending state, and the caller only writes the fields and an onSubmit.
 */
export function FormModal({
  open,
  title,
  description,
  onClose,
  onSubmit,
  submitLabel,
  submitting = false,
  submitDisabled = false,
  danger = false,
  size = "md",
  children
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  danger?: boolean;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  const formId = useId();
  return (
    <Modal
      description={description}
      footer={
        <>
          <Btn disabled={submitting} onClick={onClose}>
            Cancel
          </Btn>
          <Btn disabled={submitDisabled} form={formId} loading={submitting} type="submit" variant={danger ? "solidDanger" : "primary"}>
            {submitLabel}
          </Btn>
        </>
      }
      isOpen={open}
      onClose={submitting ? () => undefined : onClose}
      size={size}
      title={title}
    >
      <form
        className="space-y-3"
        id={formId}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (!submitting && !submitDisabled) onSubmit();
        }}
      >
        {children}
      </form>
    </Modal>
  );
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <FormModal danger={danger} onClose={onClose} onSubmit={onConfirm} open={open} submitLabel={confirmLabel} submitting={busy} title={title}>
      <div className="text-sm text-slate-600">{message}</div>
    </FormModal>
  );
}
