import type { ReactNode } from "react";

type ToastTone = "success" | "info" | "warning" | "danger";

type ToastProps = {
  action?: ReactNode;
  message: ReactNode;
  onDismiss?: () => void;
  tone?: ToastTone;
};

const toneClasses: Record<ToastTone, string> = {
  success: "border-[var(--success-100)] bg-[var(--success-100)] text-[var(--success-600)]",
  info: "border-[var(--info-100)] bg-[var(--info-100)] text-[var(--info-600)]",
  warning: "border-[var(--warning-100)] bg-[var(--warning-100)] text-[var(--warning-600)]",
  danger: "border-[var(--danger-100)] bg-[var(--danger-100)] text-[var(--danger-600)]"
};

export function Toast({ action, message, onDismiss, tone = "info" }: ToastProps) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-[13px] font-semibold ${toneClasses[tone]}`} role="status">
      <span>{message}</span>
      <div className="flex items-center gap-2">
        {action}
        {onDismiss ? (
          <button className="underline-offset-2 hover:underline" onClick={onDismiss} type="button">
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
