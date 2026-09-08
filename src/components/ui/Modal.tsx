import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-0 shadow-xl backdrop:bg-black/40 open:flex open:flex-col"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
        <h2 className="text-lg text-[var(--color-text-primary)]">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}

export function ModalFooter({
  onCancel,
  onConfirm,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  loading = false,
  confirmDisabled = false,
  confirmVariant = "primary",
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  confirmDisabled?: boolean;
  confirmVariant?: "primary" | "danger";
}) {
  return (
  <>
    <Button variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
    <Button
      variant={confirmVariant}
      onClick={onConfirm}
      loading={loading}
      disabled={confirmDisabled}
    >
      {confirmLabel}
    </Button>
  </>
  );
}
