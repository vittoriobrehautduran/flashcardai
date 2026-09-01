import { type ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 text-[var(--color-text-muted)]" aria-hidden>
          {icon}
        </div>
      )}
      <h2 className="text-xl text-[var(--color-text-primary)]">{title}</h2>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-[var(--color-text-secondary)]">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button className="mt-6" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
