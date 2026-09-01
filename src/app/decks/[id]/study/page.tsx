"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useLocale } from "@/components/providers/LocaleProvider";

interface StudyCard {
  id: string;
  front: string;
  back: string;
}

export default function StudyPage() {
  const { t, fmt } = useLocale();
  const params = useParams();
  const deckId = params.id as string;

  const ratings = useMemo(
    () => [
      { value: 1, label: t.study.again, variant: "danger" as const, hint: t.study.againHint },
      { value: 2, label: t.study.hard, variant: "secondary" as const, hint: t.study.hardHint },
      { value: 3, label: t.study.good, variant: "primary" as const, hint: t.study.goodHint },
      { value: 4, label: t.study.easy, variant: "secondary" as const, hint: t.study.easyHint },
    ],
    [t]
  );

  const [cards, setCards] = useState<StudyCard[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/decks/${deckId}/study/session`);
      if (!res.ok) throw new Error(t.study.failedLoad);
      const data = await res.json();

      if (data.session) {
        setSessionId(data.session.id);
        setCards(data.cards);
        setCurrentIndex(data.session.currentIndex);
        setReviewedCount(data.session.reviewedCount);
        setRevealed(false);
        return;
      }

      const dueRes = await fetch(`/api/decks/${deckId}/study`);
      if (!dueRes.ok) throw new Error(t.study.failedLoad);
      const dueData = await dueRes.json();
      const dueCards = dueData.cards as StudyCard[];

      if (dueCards.length === 0) {
        setCards([]);
        setSessionId(null);
        return;
      }

      const startRes = await fetch(`/api/decks/${deckId}/study/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: dueCards.map((c) => c.id) }),
      });

      if (!startRes.ok) throw new Error(t.study.failedLoad);
      const startData = await startRes.json();
      setSessionId(startData.session.id);
      setCards(startData.cards);
      setCurrentIndex(0);
      setReviewedCount(0);
      setRevealed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.study.failedLoad);
    } finally {
      setLoading(false);
    }
  }, [deckId, t]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const currentCard = cards[currentIndex];
  const totalInSession = cards.length;
  const progress = totalInSession > 0 ? (reviewedCount / totalInSession) * 100 : 0;

  const handleRating = useCallback(async (rating: number) => {
    if (!currentCard || submitting || !sessionId) return;

    const nextReviewed = reviewedCount + 1;
    const nextIndex = currentIndex + 1;
    const isLast = nextIndex >= cards.length;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/decks/${deckId}/study`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: currentCard.id,
          rating,
          sessionId,
          currentIndex: isLast ? currentIndex : nextIndex,
          reviewedCount: nextReviewed,
          sessionComplete: isLast,
        }),
      });

      if (!res.ok) throw new Error(t.study.failedSubmit);

      setReviewedCount(nextReviewed);
      setRevealed(false);

      if (isLast) {
        setSessionId(null);
        setCards([]);
      } else {
        setCurrentIndex(nextIndex);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.study.failedSubmit);
    } finally {
      setSubmitting(false);
    }
  }, [
    currentCard,
    submitting,
    sessionId,
    deckId,
    reviewedCount,
    currentIndex,
    cards.length,
    t,
  ]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!currentCard) return;

      if (e.code === "Space" && !revealed) {
        e.preventDefault();
        setRevealed(true);
        return;
      }

      if (revealed && !submitting) {
        const rating = Number(e.key);
        if (rating >= 1 && rating <= 4) {
          handleRating(rating);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentCard, revealed, submitting, handleRating]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-32 rounded bg-[var(--color-border)] mb-8" />
        <div className="h-64 rounded-xl bg-[var(--color-border)]" />
      </div>
    );
  }

  if (!loading && cards.length === 0 && reviewedCount === 0) {
    return (
      <div>
        <nav className="mb-4 text-sm text-[var(--color-text-muted)]">
          <Link href={`/decks/${deckId}`} className="text-[var(--color-text-secondary)] no-underline">
            ← {t.common.backToDeck}
          </Link>
        </nav>
        <EmptyState
          title={t.study.nothingDueTitle}
          description={t.study.nothingDueDescription}
          actionLabel={t.common.backToDeck}
          onAction={() => window.location.href = `/decks/${deckId}`}
        />
      </div>
    );
  }

  if (!loading && cards.length === 0 && reviewedCount > 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-3xl text-[var(--color-text-primary)]">{t.study.sessionComplete}</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {fmt(t.study.reviewedCount, { count: reviewedCount })}
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <Link href={`/decks/${deckId}`}>
            <Button variant="secondary">{t.common.backToDeck}</Button>
          </Link>
          <Button onClick={loadSession}>{t.study.studyMore}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <nav className="mb-6 text-sm text-[var(--color-text-muted)]">
        <Link href={`/decks/${deckId}`} className="text-[var(--color-text-secondary)] no-underline hover:text-[var(--color-text-primary)]">
          ← {t.common.backToDeck}
        </Link>
      </nav>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      <p className="mb-4 text-xs text-[var(--color-text-muted)]">{t.study.sessionSaved}</p>

      <div className="mb-6">
        <ProgressBar
          value={progress}
          label={fmt(t.study.reviewedProgress, { done: reviewedCount, total: totalInSession })}
        />
      </div>

      {currentCard && (
        <>
          <button
            type="button"
            onClick={() => !revealed && setRevealed(true)}
            className="w-full text-left"
          >
            <Card className="min-h-[280px] flex flex-col justify-center transition-colors hover:border-[var(--color-border-strong)]">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                {revealed ? t.study.answer : t.study.question}
              </p>
              <p className="mt-4 text-xl text-[var(--color-text-primary)] font-[family-name:var(--font-display)]">
                {revealed ? currentCard.back : currentCard.front}
              </p>
              {!revealed && (
                <p className="mt-8 text-sm text-[var(--color-text-muted)]">{t.study.revealHint}</p>
              )}
            </Card>
          </button>

          {revealed && (
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ratings.map((r) => (
                <Button
                  key={r.value}
                  variant={r.variant}
                  disabled={submitting}
                  onClick={() => handleRating(r.value)}
                  className="flex-col gap-0.5 py-3"
                >
                  <span>{r.label}</span>
                  <span className="text-xs opacity-70">{r.hint}</span>
                </Button>
              ))}
            </div>
          )}

          <p className="mt-4 text-center text-xs text-[var(--color-text-muted)]">{t.study.keysHint}</p>
        </>
      )}
    </div>
  );
}
