import { type ReactNode } from "react";

interface AlertProps {
  variant?: "info" | "error" | "success" | "warning";
  children: ReactNode;
  className?: string;
}

const styles = {
  info: "bg-[var(--color-accent-muted)] text-[var(--color-accent)] border-[var(--color-accent)]/20",
  error: "bg-[var(--color-danger-muted)] text-[var(--color-danger)] border-[var(--color-danger)]/20",
  success: "bg-[var(--color-success-muted)] text-[var(--color-success)] border-[var(--color-success)]/20",
  warning: "bg-[var(--color-warning-muted)] text-[var(--color-warning)] border-[var(--color-warning)]/20",
};

export function Alert({ variant = "info", children, className = "" }: AlertProps) {
  return (
    <div
      className={[
        "rounded-lg border px-4 py-3 text-sm",
        styles[variant],
        className,
      ].join(" ")}
      role="alert"
    >
      {children}
    </div>
  );
}
