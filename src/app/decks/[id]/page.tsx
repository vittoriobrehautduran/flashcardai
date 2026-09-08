"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { useLocale } from "@/components/providers/LocaleProvider";

interface ModuleData {
  id: string;
  name: string;
  description: string | null;
}

interface QuestionItem {
  id: string;
  front: string;
  back: string;
  sourceSection: string | null;
}

interface ModuleProgress {
  cardCount: number;
  studiedCount: number;
  dueCount: number;
  newCount: number;
  lastStudyAt: string | null;
  lastQuizPercent: number | null;
  lastQuizAt: string | null;
  activeStudySession: { currentIndex: number; reviewedCount: number; total: number } | null;
  activeQuizSession: { currentIndex: number; score: number; total: number } | null;
}

export default function ModulePage() {
  const { t, fmt, locale } = useLocale();
  const params = useParams();
  const moduleId = params.id as string;

  const [moduleData, setModuleData] = useState<ModuleData | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ModuleProgress | null>(null);
  const [showQuestions, setShowQuestions] = useState(false);

  const loadModule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // One request: module + progress (no full question dump until needed).
      const res = await fetch(`/api/decks/${moduleId}`);
      if (!res.ok) throw new Error(t.module.failedLoad);
      const data = await res.json();
      setModuleData(data.deck);
      setProgress(data.progress ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.module.failedLoad);
    } finally {
      setLoading(false);
    }
  }, [moduleId, t]);

  useEffect(() => {
    loadModule();
  }, [loadModule]);

  async function loadQuestions() {
    if (questions !== null) return;
    setLoadingQuestions(true);
    try {
      const res = await fetch(`/api/decks/${moduleId}?cards=1`);
      if (!res.ok) throw new Error(t.module.failedLoad);
      const data = await res.json();
      setQuestions(data.cards ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.module.failedLoad);
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function handleToggleQuestions() {
    const next = !showQuestions;
    setShowQuestions(next);
    if (next) await loadQuestions();
  }

  async function handleDeleteQuestion(cardId: string) {
    setDeletingId(cardId);
    try {
      await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
      setQuestions((prev) => (prev ? prev.filter((q) => q.id !== cardId) : prev));
      setProgress((prev) =>
        prev
          ? {
              ...prev,
              cardCount: Math.max(0, prev.cardCount - 1),
            }
          : prev
      );
    } catch {
      setError(t.module.failedDelete);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[var(--color-border)]" />
        <div className="h-24 rounded-xl bg-[var(--color-border)]" />
      </div>
    );
  }

  if (!moduleData) {
    return (
      <EmptyState
        title={t.module.notFoundTitle}
        description={t.module.notFoundDescription}
        actionLabel={t.common.backToModules}
        onAction={() => {
          window.location.href = "/";
        }}
      />
    );
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale === "sv" ? "sv-SE" : "en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const questionCount = progress?.cardCount ?? questions?.length ?? 0;
  const hasQuestions = questionCount > 0;

  const features = [
    {
      href: `/decks/${moduleId}/study`,
      title: t.module.featureFlashcards,
      description: t.module.featureFlashcardsDesc,
      cta: t.module.featureFlashcardsCta,
      badge: progress?.activeStudySession
        ? fmt(t.module.resumeStudy, {
            current: progress.activeStudySession.reviewedCount,
            total: progress.activeStudySession.total,
          })
        : progress && progress.dueCount > 0
          ? fmt(t.home.badgeDue, { count: progress.dueCount })
          : null,
    },
    {
      href: `/decks/${moduleId}/quiz?mode=choice`,
      title: t.module.featureQuiz,
      description: t.module.featureQuizDesc,
      cta: t.module.featureQuizCta,
      badge: progress?.activeQuizSession
        ? fmt(t.module.resumeQuiz, {
            current: progress.activeQuizSession.currentIndex + 1,
            total: progress.activeQuizSession.total,
          })
        : null,
    },
    {
      href: `/decks/${moduleId}/quiz?mode=written`,
      title: t.module.featureFeedback,
      description: t.module.featureFeedbackDesc,
      cta: t.module.featureFeedbackCta,
      badge: null,
    },
  ];

  return (
    <div>
      <nav className="mb-4 text-sm text-[var(--color-text-muted)]" aria-label="Breadcrumb">
        <Link
          href="/"
          className="text-[var(--color-text-secondary)] no-underline hover:text-[var(--color-text-primary)]"
        >
          {t.nav.modules}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-[var(--color-text-primary)]">{moduleData.name}</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl text-[var(--color-text-primary)]">{moduleData.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {fmt(t.module.questionCount, { count: questionCount })}
        </p>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {!hasQuestions ? (
        <section aria-labelledby="next-step-title">
          <Card className="border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)]/30">
            <p
              id="next-step-title"
              className="text-xs font-medium uppercase tracking-wide text-[var(--color-accent)]"
            >
              {t.module.nextStepTitle}
            </p>
            <h2 className="mt-2 text-xl text-[var(--color-text-primary)]">
              {t.module.needsQuestionsTitle}
            </h2>
            <p className="mt-2 max-w-lg text-sm text-[var(--color-text-secondary)]">
              {t.module.needsQuestionsDescription}
            </p>
            <div className="mt-5">
              <Link href={`/decks/${moduleId}/import`}>
                <Button>{t.module.generateQuestions}</Button>
              </Link>
            </div>
          </Card>
        </section>
      ) : (
        <>
          <section className="mb-10" aria-labelledby="study-title">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="study-title" className="text-xl text-[var(--color-text-primary)]">
                  {t.module.studyTitle}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {t.module.studySubtitle}
                </p>
              </div>
              <Link href={`/decks/${moduleId}/import`}>
                <Button variant="secondary">{t.module.generateNewQuestions}</Button>
              </Link>
            </div>

            {progress && (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <Badge>{fmt(t.module.studied, { count: progress.studiedCount })}</Badge>
                {progress.dueCount > 0 && (
                  <Badge variant="accent">
                    {fmt(t.home.badgeDue, { count: progress.dueCount })}
                  </Badge>
                )}
                {progress.lastStudyAt && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {fmt(t.module.lastStudy, { date: formatDate(progress.lastStudyAt) })}
                  </span>
                )}
                {progress.lastQuizPercent !== null && progress.lastQuizAt && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {fmt(t.module.lastQuiz, { percent: progress.lastQuizPercent })}
                  </span>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              {features.map((feature) => (
                <Card
                  key={feature.href}
                  className="flex h-full flex-col transition-colors hover:border-[var(--color-accent)]"
                >
                  <h3 className="text-lg text-[var(--color-text-primary)]">{feature.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-[var(--color-text-secondary)]">
                    {feature.description}
                  </p>
                  {feature.badge && (
                    <Badge variant="accent" className="mt-3 w-fit">
                      {feature.badge}
                    </Badge>
                  )}
                  <Link href={feature.href} className="mt-4 no-underline">
                    <Button className="w-full" variant="secondary">
                      {feature.cta}
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          </section>

          <section aria-labelledby="manage-title">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="manage-title" className="text-xl text-[var(--color-text-primary)]">
                  {t.module.manageTitle}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {t.module.manageSubtitle}
                </p>
              </div>
              <Button variant="ghost" onClick={handleToggleQuestions} loading={loadingQuestions}>
                {showQuestions ? t.module.hideQuestions : t.module.showQuestions}
              </Button>
            </div>

            {showQuestions && questions && (
              <ul className="space-y-3" role="list">
                {questions.map((q) => (
                  <li key={q.id}>
                    <Card className="!p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">
                            {q.front}
                          </p>
                          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{q.back}</p>
                          {q.sourceSection && (
                            <Badge variant="muted" className="mt-2">
                              {q.sourceSection}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          className="shrink-0 text-xs"
                          disabled={deletingId === q.id}
                          onClick={() => handleDeleteQuestion(q.id)}
                        >
                          {t.common.remove}
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
