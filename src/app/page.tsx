"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { useLocale } from "@/components/providers/LocaleProvider";

interface ModuleSummary {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
  dueCount: number;
  newCount: number;
  updatedAt: string;
}

export default function HomePage() {
  const { t, fmt } = useLocale();
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const loadModules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decks");
      if (!res.ok) throw new Error(t.home.failedLoad);
      const data = await res.json();
      setModules(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.somethingWrong);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadApiKeyStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        setHasApiKey(false);
        return;
      }
      const data = await res.json();
      setHasApiKey(Boolean(data.hasKey));
    } catch {
      setHasApiKey(false);
    }
  }, []);

  useEffect(() => {
    loadModules();
    loadApiKeyStatus();
  }, [loadModules, loadApiKeyStatus]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(t.home.failedCreate);
      setModalOpen(false);
      setNewName("");
      await loadModules();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.home.failedCreate);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl text-[var(--color-text-primary)]">{t.home.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.home.subtitle}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>{t.home.createModule}</Button>
      </div>

      {hasApiKey === false && (
        <Alert variant="warning" className="mb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{t.settings.missingKeyBanner}</span>
            <Link href="/settings">
              <Button variant="secondary">{t.settings.openSettings}</Button>
            </Link>
          </div>
        </Alert>
      )}

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]"
            />
          ))}
        </div>
      ) : modules.length === 0 ? (
        <EmptyState
          title={t.home.noModulesTitle}
          description={t.home.noModulesDescription}
          actionLabel={t.home.createModule}
          onAction={() => setModalOpen(true)}
          icon={
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="12" width="32" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16 20h16M16 26h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" role="list">
          {modules.map((mod) => (
            <li key={mod.id}>
              <Link href={`/decks/${mod.id}`} className="block no-underline">
                <Card className="transition-colors hover:border-[var(--color-border-strong)]">
                  <h2 className="text-lg text-[var(--color-text-primary)]">{mod.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge>{fmt(t.home.badgeQuestions, { count: mod.cardCount })}</Badge>
                    {mod.dueCount > 0 && (
                      <Badge variant="accent">{fmt(t.home.badgeDue, { count: mod.dueCount })}</Badge>
                    )}
                    {mod.newCount > 0 && (
                      <Badge variant="warning">{fmt(t.home.badgeNew, { count: mod.newCount })}</Badge>
                    )}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t.home.createModule}
        footer={
          <ModalFooter
            onCancel={() => setModalOpen(false)}
            onConfirm={handleCreate}
            confirmLabel={t.home.createModule}
            cancelLabel={t.common.cancel}
            loading={creating}
            confirmDisabled={!newName.trim()}
          />
        }
      >
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
          <label htmlFor="module-name" className="text-sm font-medium text-[var(--color-text-primary)]">
            {t.home.moduleName}
          </label>
          <input
            id="module-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.home.moduleNamePlaceholder}
            className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            autoFocus
          />
        </form>
      </Modal>
    </div>
  );
}
