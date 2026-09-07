"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { useLocale } from "@/components/providers/LocaleProvider";

export default function SettingsPage() {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.settings.failedLoad);
      setHasKey(Boolean(data.hasKey));
      setMaskedKey(data.maskedKey ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.settings.failedLoad);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const key = apiKeyInput.trim();
    if (!key) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiApiKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.settings.failedSave);

      setHasKey(Boolean(data.hasKey));
      setMaskedKey(data.maskedKey ?? null);
      setApiKeyInput("");
      setSuccess(t.settings.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.settings.failedSave);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/settings", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.settings.failedRemove);

      setHasKey(false);
      setMaskedKey(null);
      setSuccess(t.settings.removed);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.settings.failedRemove);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <nav className="mb-6 text-sm text-[var(--color-text-muted)]">
        <Link
          href="/"
          className="text-[var(--color-text-secondary)] no-underline hover:text-[var(--color-text-primary)]"
        >
          ← {t.common.backToModules}
        </Link>
      </nav>

      <h1 className="text-3xl text-[var(--color-text-primary)]">{t.settings.title}</h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.settings.subtitle}</p>

      {error && (
        <Alert variant="error" className="mt-6">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mt-6">
          {success}
        </Alert>
      )}

      <Card className="mt-6">
        <h2 className="text-lg text-[var(--color-text-primary)]">{t.settings.languageTitle}</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.settings.languageDescription}</p>
        <div className="mt-4">
          <LanguageToggle />
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg text-[var(--color-text-primary)]">{t.settings.geminiTitle}</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {t.settings.geminiDescription}{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-accent)] underline"
          >
            aistudio.google.com/apikey
          </a>
        </p>

        {loading ? (
          <div className="mt-4 h-10 animate-pulse rounded-lg bg-[var(--color-border)]" />
        ) : (
          <>
            <div className="mt-4 rounded-lg bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              {hasKey
                ? `${t.settings.currentKey}: ${maskedKey}`
                : t.settings.noKeyYet}
            </div>

            <form className="mt-4 flex flex-col gap-3" onSubmit={handleSave}>
              <label
                htmlFor="gemini-api-key"
                className="text-sm font-medium text-[var(--color-text-primary)]"
              >
                {hasKey ? t.settings.replaceKey : t.settings.pasteKey}
              </label>
              <input
                id="gemini-api-key"
                type="password"
                autoComplete="off"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIza…"
                className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={saving} disabled={!apiKeyInput.trim()}>
                  {t.settings.saveKey}
                </Button>
                {hasKey && (
                  <Button
                    type="button"
                    variant="danger"
                    loading={removing}
                    onClick={handleRemove}
                  >
                    {t.settings.removeKey}
                  </Button>
                )}
              </div>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
