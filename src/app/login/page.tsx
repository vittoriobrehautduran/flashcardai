"use client";

// Login screen shown to signed-out users. The actual login form lives in
// the Cognito hosted UI; this page just starts that flow.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { useLocale } from "@/components/providers/LocaleProvider";

function LoginContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();

  // Carry along where the user was headed so they land there after login.
  const nextParam = searchParams.get("next");
  const nextPath = nextParam && nextParam.startsWith("/") ? nextParam : "/";
  const loginHref = `/api/auth/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="mx-auto mt-16 max-w-md">
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-text-primary)]">
          {t.auth.loginTitle}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t.auth.loginSubtitle}
        </p>
        <a
          href={loginHref}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-transparent bg-[var(--color-accent)] px-6 py-2 text-sm font-medium text-white no-underline transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          {t.auth.signIn}
        </a>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
