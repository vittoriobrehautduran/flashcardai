import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] border-transparent",
  secondary:
    "bg-[var(--color-surface-raised)] text-[var(--color-text-primary)] border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]",
  ghost:
    "bg-transparent text-[var(--color-text-secondary)] border-transparent hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]",
  danger:
    "bg-[var(--color-danger-muted)] text-[var(--color-danger)] border-transparent hover:bg-[#f9d9d6]",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      disabled={isDisabled}
      className={[
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {loading && (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}
