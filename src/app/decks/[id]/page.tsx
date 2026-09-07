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
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ModuleProgress | null>(null);

  const loadModule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/decks/${moduleId}`);
      if (!res.ok) throw new Error(t.module.failedLoad);
      const data = await res.json();
      setModuleData(data.deck);
      setQuestions(data.cards);

      const progressRes = await fetch(`/api/decks/${moduleId}/progress`);
      if (progressRes.ok) {
        setProgress(await progressRes.json());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.module.failedLoad);
    } finally {
      setLoading(false);
    }
  }, [moduleId, t]);

  useEffect(() => {
    loadModule();
  }, [loadModule]);

  async function handleDeleteQuestion(cardId: string) {
    setDeletingId(cardId);
    try {
      await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
      setQuestions((prev) => prev.filter((q) => q.id !== cardId));
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

  const hasQuestions = questions.length > 0;

  const features = [
    {
      href: `/decks/${moduleId}/study`,
      title: t.module.featureFlashcards,
      description: t.module.featureFlashcardsDesc,
      badge: progress?.activeStudySession
        ? fmt(t.module.resumeStudy, {
            current: progress.activeStudySession.reviewedCount,
            total: progress.activeStudySession.total,
          })
        : null,
    },
    {
      href: `/decks/${moduleId}/quiz?mode=choice`,
      title: t.module.featureQuiz,
      description: t.module.featureQuizDesc,
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
      badge: null,
    },
  ];

  return (
    <div>
      <nav className="mb-4 text-sm text-[var(--color-text-muted)]" aria-label="Breadcrumb">
        <Link href="/" className="text-[var(--color-text-secondary)] no-underline hover:text-[var(--color-text-primary)]">
          {t.nav.modules}
        </Link>
        <span className="mx-2">›</span>
        <span>{moduleData.name}</span>
      </nav>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl text-[var(--color-text-primary)]">{moduleData.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {fmt(t.module.questionCount, { count: questions.length })}
          </p>
        </div>
        <Link href={`/decks/${moduleId}/import`}>
          <Button>
            {hasQuestions ? t.module.generateNewQuestions : t.module.generateQuestions}
          </Button>
        </Link>
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {!hasQuestions ? (
        <EmptyState
          title={t.module.needsQuestionsTitle}
          description={t.module.needsQuestionsDescription}
          actionLabel={t.module.generateQuestions}
          onAction={() => {
            window.location.href = `/decks/${moduleId}/import`;
          }}
        />
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {features.map((feature) => (
              <Link key={feature.href} href={feature.href} className="block no-underline">
                <Card className="h-full transition-colors hover:border-[var(--color-accent)]">
                  <h2 className="text-lg text-[var(--color-text-primary)]">{feature.title}</h2>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{feature.description}</p>
                  {feature.badge && (
                    <Badge variant="accent" className="mt-3">
                      {feature.badge}
                    </Badge>
                  )}
                </Card>
              </Link>
            ))}
          </div>

          {progress && (
            <Card className="mb-8">
              <h2 className="text-sm font-medium text-[var(--color-text-primary)]">{t.module.progressTitle}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{fmt(t.module.studied, { count: progress.studiedCount })}</Badge>
                {progress.dueCount > 0 && (
                  <Badge variant="accent">{fmt(t.home.badgeDue, { count: progress.dueCount })}</Badge>
                )}
                {progress.newCount > 0 && (
                  <Badge variant="warning">{fmt(t.home.badgeNew, { count: progress.newCount })}</Badge>
                )}
              </div>
              <div className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
                {progress.lastStudyAt ? (
                  <p>{fmt(t.module.lastStudy, { date: formatDate(progress.lastStudyAt) })}</p>
                ) : (
                  <p>{t.module.noStudyYet}</p>
                )}
                {progress.lastQuizPercent !== null && progress.lastQuizAt ? (
                  <p>
                    {fmt(t.module.lastQuiz, { percent: progress.lastQuizPercent })} —{" "}
                    {formatDate(progress.lastQuizAt)}
                  </p>
                ) : (
                  <p>{t.module.noQuizYet}</p>
                )}
                {(progress.activeStudySession || progress.activeQuizSession) && (
                  <p className="text-[var(--color-accent)]">{t.module.activeSession}</p>
                )}
              </div>
            </Card>
          )}

          <h2 className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">
            {t.module.questionsTitle}
          </h2>
          <ul className="space-y-3" role="list">
            {questions.map((q) => (
              <li key={q.id}>
                <Card>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{q.front}</p>
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
        </>
      )}
    </div>
  );
}
