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

interface ModulesMeta {
  isAdmin: boolean;
  moduleLimit: number | null;
  moduleCount: number;
}

export default function HomePage() {
  const { t, fmt } = useLocale();
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [meta, setMeta] = useState<ModulesMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModuleSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const atModuleLimit =
    meta !== null &&
    !meta.isAdmin &&
    meta.moduleLimit !== null &&
    meta.moduleCount >= meta.moduleLimit;

  const loadModules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decks");
      if (!res.ok) throw new Error(t.home.failedLoad);
      const data = await res.json();
      setModules(Array.isArray(data) ? data : data.decks ?? []);
      setMeta(data.meta ?? null);
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "MODULE_LIMIT") {
          throw new Error(
            fmt(t.home.moduleLimitReached, { limit: data.limit ?? meta?.moduleLimit ?? 4 })
          );
        }
        throw new Error(data.error || t.home.failedCreate);
      }
      setModalOpen(false);
      setNewName("");
      await loadModules();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.home.failedCreate);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteModule() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/decks/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t.home.failedDelete);
      setDeleteTarget(null);
      await loadModules();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.home.failedDelete);
    } finally {
      setDeleting(false);
    }
  }

  const howSteps = [
    { title: t.home.howStep1, desc: t.home.howStep1Desc },
    { title: t.home.howStep2, desc: t.home.howStep2Desc },
    { title: t.home.howStep3, desc: t.home.howStep3Desc },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 className="text-3xl text-[var(--color-text-primary)]">{t.home.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.home.subtitle}</p>
          {meta && !meta.isAdmin && meta.moduleLimit !== null && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {fmt(t.home.moduleLimitHint, {
                count: meta.moduleCount,
                limit: meta.moduleLimit,
              })}
            </p>
          )}
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          disabled={atModuleLimit}
          title={atModuleLimit ? t.home.moduleLimitReachedShort : undefined}
        >
          {t.home.createModule}
        </Button>
      </div>

      {/* Short orientation — only until the user has a few modules */}
      {modules.length < 3 && !loading && (
        <section className="mb-8" aria-labelledby="how-title">
          <h2
            id="how-title"
            className="mb-3 text-sm font-medium text-[var(--color-text-primary)]"
          >
            {t.home.howTitle}
          </h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {howSteps.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full !p-4">
                  <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-[var(--color-accent-muted)] text-sm font-medium text-[var(--color-accent)]">
                    {index + 1}
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    {step.desc}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}

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

      {atModuleLimit && (
        <Alert variant="warning" className="mb-6">
          {fmt(t.home.moduleLimitReached, { limit: meta?.moduleLimit ?? 4 })}
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
              className="h-36 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]"
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
              <Card className="flex h-full flex-col transition-colors hover:border-[var(--color-border-strong)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg text-[var(--color-text-primary)]">{mod.name}</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mod.cardCount > 0 ? (
                        <Badge>{fmt(t.home.badgeQuestions, { count: mod.cardCount })}</Badge>
                      ) : (
                        <Badge variant="muted">{t.home.badgeEmpty}</Badge>
                      )}
                      {mod.dueCount > 0 && (
                        <Badge variant="accent">
                          {fmt(t.home.badgeDue, { count: mod.dueCount })}
                        </Badge>
                      )}
                      {mod.newCount > 0 && (
                        <Badge variant="warning">
                          {fmt(t.home.badgeNew, { count: mod.newCount })}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-[var(--color-border)] pt-4">
                  <Link href={`/decks/${mod.id}`} className="min-w-0 flex-1 no-underline">
                    <Button className="w-full">{t.home.openModule}</Button>
                  </Link>
                  <Button
                    variant="danger"
                    className="shrink-0"
                    onClick={() => setDeleteTarget(mod)}
                    aria-label={`${t.home.deleteModule}: ${mod.name}`}
                  >
                    {t.home.deleteModule}
                  </Button>
                </div>
              </Card>
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
            confirmDisabled={!newName.trim() || atModuleLimit}
          />
        }
      >
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
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

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        title={t.home.deleteConfirmTitle}
        footer={
          <ModalFooter
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleDeleteModule}
            confirmLabel={t.home.deleteModule}
            cancelLabel={t.common.cancel}
            loading={deleting}
            confirmVariant="danger"
          />
        }
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          {deleteTarget
            ? fmt(t.home.deleteConfirm, { name: deleteTarget.name })
            : null}
        </p>
      </Modal>
    </div>
  );
}
