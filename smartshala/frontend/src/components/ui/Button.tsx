import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)] active:bg-[var(--brand-primary-active)] disabled:bg-[var(--button-disabled-bg)] disabled:text-[var(--button-disabled-text)]",
  secondary: "border border-[var(--button-secondary-border)] bg-white text-[var(--button-secondary-text)] hover:bg-[var(--surface-50)]",
  destructive: "bg-[var(--danger-600)] text-white hover:bg-[#A51D24] active:bg-[#861820]",
  ghost: "bg-transparent text-[var(--brand-primary)] hover:bg-[var(--info-100)]"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-8 px-3 text-[12px]",
  md: "min-h-10 px-4 text-[13px]",
  lg: "min-h-12 px-5 text-[15px]"
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  children,
  className,
  disabled,
  isLoading = false,
  leftIcon,
  rightIcon,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[color:rgb(36_86_230/40%)] focus:ring-offset-2 disabled:pointer-events-none",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? <span className="h-4 w-4 rounded-full border-2 border-current/40 border-t-current animate-spin" /> : leftIcon}
      {children}
      {!isLoading ? rightIcon : null}
    </button>
  );
}
