"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/messages";

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  function select(next: AppLocale) {
    setLocale(next);
  }

  return (
    <div
      className="flex rounded-lg border border-[var(--color-border-strong)] p-0.5"
      role="group"
      aria-label={t.import.flashcardLanguage}
    >
      <button
        type="button"
        onClick={() => select("sv")}
        className={[
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors min-h-8",
          locale === "sv"
            ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
        ].join(" ")}
      >
        SV
      </button>
      <button
        type="button"
        onClick={() => select("en")}
        className={[
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors min-h-8",
          locale === "en"
            ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
        ].join(" ")}
      >
        EN
      </button>
    </div>
  );
}
