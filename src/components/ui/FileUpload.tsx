"use client";

import { useRef, type DragEvent } from "react";

interface FileUploadProps {
  accept?: string;
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}

export function FileUpload({
  accept = "application/pdf",
  onFileSelect,
  disabled = false,
  label = "Upload PDF",
  hint = "PDF only. Drag and drop or click to browse.",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (file && !disabled) onFileSelect(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div
      className={[
        "rounded-xl border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8 text-center transition-colors",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-muted)]/30",
      ].join(" ")}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>
    </div>
  );
}
