import { type ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "accent" | "warning" | "muted";
  className?: string;
}

const variants = {
  default: "bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
  accent: "bg-[var(--color-accent-muted)] text-[var(--color-accent)]",
  warning: "bg-[var(--color-warning-muted)] text-[var(--color-warning)]",
  muted: "bg-[var(--color-border)] text-[var(--color-text-muted)]",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
