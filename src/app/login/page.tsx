"use client";

// Full-bleed sign-in screen. Cognito Hosted UI owns the actual credentials form;
// this page is the branded doorway into that flow — no app chrome.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { useLocale } from "@/components/providers/LocaleProvider";

function LoginContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();

  // Carry along where the user was headed so they land there after login.
  const nextParam = searchParams.get("next");
  const nextPath = nextParam && nextParam.startsWith("/") ? nextParam : "/";
  const loginHref = `/api/auth/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="login-screen relative flex min-h-screen flex-col overflow-hidden">
      {/* Soft atmosphere — warm paper + deep green wash, no flat fill */}
      <div className="login-atmosphere pointer-events-none absolute inset-0" aria-hidden />
      <div className="login-grid pointer-events-none absolute inset-0" aria-hidden />

      <header className="login-fade relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--color-text-primary)] sm:text-2xl">
          {t.nav.appName}
        </span>
        <LanguageToggle />
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-8 text-center sm:px-10">
        <p className="login-fade login-fade-delay-1 mb-5 text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
          {t.auth.eyebrow}
        </p>

        <h1 className="login-fade login-fade-delay-2 max-w-xl font-[family-name:var(--font-display)] text-[2.75rem] leading-[1.05] tracking-tight text-[var(--color-text-primary)] sm:text-6xl sm:leading-[1.05]">
          {t.auth.loginTitle}
        </h1>

        <p className="login-fade login-fade-delay-3 mt-5 max-w-md text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
          {t.auth.loginSubtitle}
        </p>

        <div className="login-fade login-fade-delay-4 mt-10 flex flex-col items-center gap-4">
          <a
            href={loginHref}
            className="login-cta inline-flex min-h-12 min-w-[12rem] items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 text-base font-medium text-white no-underline shadow-[0_12px_32px_-12px_rgba(45,106,79,0.55)] transition-[transform,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--color-accent-hover)] hover:shadow-[0_16px_40px_-12px_rgba(45,106,79,0.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] active:translate-y-0"
          >
            {t.auth.signIn}
          </a>
          <p className="max-w-xs text-sm text-[var(--color-text-muted)]">{t.auth.loginHint}</p>
        </div>
      </main>

      {/* Decorative study cards — visual product cue, not interactive chrome */}
      <div
        className="login-cards pointer-events-none absolute inset-x-0 bottom-0 z-0 hidden h-44 overflow-hidden sm:block"
        aria-hidden
      >
        <div className="login-card login-card-left absolute bottom-8 left-[8%] h-36 w-56 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]/90 p-5 shadow-[0_20px_50px_-24px_rgba(26,24,22,0.35)] backdrop-blur-sm">
          <div className="mb-3 h-2 w-16 rounded-full bg-[var(--color-accent-muted)]" />
          <div className="mb-2 h-2.5 w-[80%] rounded-full bg-[var(--color-border)]" />
          <div className="h-2.5 w-[60%] rounded-full bg-[var(--color-border)]" />
        </div>
        <div className="login-card login-card-right absolute bottom-6 right-[10%] h-40 w-60 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5 shadow-[0_24px_60px_-20px_rgba(26,24,22,0.4)]">
          <div className="mb-3 h-2 w-20 rounded-full bg-[var(--color-accent-muted)]" />
          <div className="mb-2 h-2.5 w-full rounded-full bg-[var(--color-border)]" />
          <div className="mb-2 h-2.5 w-[80%] rounded-full bg-[var(--color-border)]" />
          <div className="h-2.5 w-[40%] rounded-full bg-[var(--color-border)]" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense
      fallback={
        <div className="login-screen flex min-h-screen items-center justify-center">
          <div className="login-atmosphere absolute inset-0" aria-hidden />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
