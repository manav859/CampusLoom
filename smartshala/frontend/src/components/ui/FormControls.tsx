import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = {
  children: ReactNode;
  error?: ReactNode;
  help?: ReactNode;
  label: ReactNode;
  required?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Field({ children, error, help, label, required }: FieldProps) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-[var(--ink-900)]">
        {label}
        {required ? <span className="ml-1 text-[var(--danger-600)]">*</span> : null}
      </span>
      <div className="mt-2">{children}</div>
      {help ? <p className="mt-1 text-[12px] font-medium text-[var(--ink-500)]">{help}</p> : null}
      {error ? <p className="mt-1 text-[12px] font-semibold text-[var(--danger-600)]">{error}</p> : null}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "min-h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-200)] bg-white px-3.5 text-[15px] text-[var(--ink-900)] outline-none transition focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[color:rgb(36_86_230/10%)] disabled:bg-[var(--surface-50)] disabled:text-[var(--ink-500)]",
        className
      )}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "min-h-[120px] w-full rounded-[var(--radius-lg)] border border-[var(--border-200)] bg-white px-3.5 py-2.5 text-[14px] leading-6 text-[var(--ink-900)] outline-none transition focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[color:rgb(36_86_230/10%)] disabled:bg-[var(--surface-50)] disabled:text-[var(--ink-500)]",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "min-h-11 w-full rounded-[var(--radius-lg)] border border-[var(--border-200)] bg-white px-3 text-[14px] text-[var(--ink-900)] outline-none transition focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[color:rgb(36_86_230/10%)] disabled:bg-[var(--surface-50)] disabled:text-[var(--ink-500)]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
