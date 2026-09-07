"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";

interface AppHeaderProps {
  // Whether a signed-in session exists; decided server-side in the layout.
  signedIn?: boolean;
}

export function AppHeader({ signedIn = false }: AppHeaderProps) {
  const { t } = useLocale();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-xl text-[var(--color-text-primary)] no-underline hover:opacity-80"
        >
          {t.nav.appName}
        </Link>

        <nav className="flex items-center gap-2" aria-label="Main">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] no-underline transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
          >
            {t.nav.modules}
          </Link>
          <Link
            href="/settings"
            className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] no-underline transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
          >
            {t.nav.settings}
          </Link>
          {signedIn && (
            <a
              href="/api/auth/logout"
              className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] no-underline transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
            >
              {t.auth.signOut}
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
