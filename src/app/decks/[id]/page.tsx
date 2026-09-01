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

interface Deck {
  id: string;
  name: string;
  description: string | null;
}

interface CardItem {
  id: string;
  front: string;
  back: string;
  sourceSection: string | null;
}

interface DeckProgress {
  studiedCount: number;
  dueCount: number;
  newCount: number;
  lastStudyAt: string | null;
  lastQuizPercent: number | null;
  lastQuizAt: string | null;
  activeStudySession: { currentIndex: number; reviewedCount: number; total: number } | null;
  activeQuizSession: { currentIndex: number; score: number; total: number } | null;
}

export default function DeckPage() {
  const { t, fmt, locale } = useLocale();
  const params = useParams();
  const deckId = params.id as string;

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<DeckProgress | null>(null);

  const loadDeck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/decks/${deckId}`);
      if (!res.ok) throw new Error(t.deck.failedLoad);
      const data = await res.json();
      setDeck(data.deck);
      setCards(data.cards);

      const progressRes = await fetch(`/api/decks/${deckId}/progress`);
      if (progressRes.ok) {
        setProgress(await progressRes.json());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.deck.failedLoad);
    } finally {
      setLoading(false);
    }
  }, [deckId, t]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  async function handleDeleteCard(cardId: string) {
    setDeletingId(cardId);
    try {
      await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    } catch {
      setError(t.deck.failedDelete);
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

  if (!deck) {
    return (
      <EmptyState
        title={t.deck.notFoundTitle}
        description={t.deck.notFoundDescription}
        actionLabel={t.common.backToDecks}
        onAction={() => window.location.href = "/"}
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

  return (
    <div>
      <nav className="mb-4 text-sm text-[var(--color-text-muted)]" aria-label="Breadcrumb">
        <Link href="/" className="text-[var(--color-text-secondary)] no-underline hover:text-[var(--color-text-primary)]">
          {t.nav.decks}
        </Link>
        <span className="mx-2">›</span>
        <span>{deck.name}</span>
      </nav>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl text-[var(--color-text-primary)]">{deck.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {fmt(t.deck.cardCount, { count: cards.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/decks/${deckId}/import`}>
            <Button variant="secondary">{t.deck.importPdf}</Button>
          </Link>
          <Link href={`/decks/${deckId}/quiz`}>
            <Button variant="secondary">
              {progress?.activeQuizSession
                ? fmt(t.deck.resumeQuiz, {
                    current: progress.activeQuizSession.currentIndex + 1,
                    total: progress.activeQuizSession.total,
                  })
                : t.deck.testKnowledge}
            </Button>
          </Link>
          <Link href={`/decks/${deckId}/study`}>
            <Button>
              {progress?.activeStudySession
                ? fmt(t.deck.resumeStudy, {
                    current: progress.activeStudySession.reviewedCount,
                    total: progress.activeStudySession.total,
                  })
                : t.deck.studyNow}
            </Button>
          </Link>
        </div>
      </div>

      {progress && cards.length > 0 && (
        <Card className="mb-8">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">{t.deck.progressTitle}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{fmt(t.deck.studied, { count: progress.studiedCount })}</Badge>
            {progress.dueCount > 0 && (
              <Badge variant="accent">{fmt(t.home.badgeDue, { count: progress.dueCount })}</Badge>
            )}
            {progress.newCount > 0 && (
              <Badge variant="warning">{fmt(t.home.badgeNew, { count: progress.newCount })}</Badge>
            )}
          </div>
          <div className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
            {progress.lastStudyAt ? (
              <p>{fmt(t.deck.lastStudy, { date: formatDate(progress.lastStudyAt) })}</p>
            ) : (
              <p>{t.deck.noStudyYet}</p>
            )}
            {progress.lastQuizPercent !== null && progress.lastQuizAt ? (
              <p>{fmt(t.deck.lastQuiz, { percent: progress.lastQuizPercent })} — {formatDate(progress.lastQuizAt)}</p>
            ) : (
              <p>{t.deck.noQuizYet}</p>
            )}
            {(progress.activeStudySession || progress.activeQuizSession) && (
              <p className="text-[var(--color-accent)]">{t.deck.activeSession}</p>
            )}
          </div>
        </Card>
      )}

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {cards.length === 0 ? (
        <EmptyState
          title={t.deck.noCardsTitle}
          description={t.deck.noCardsDescription}
          actionLabel={t.deck.importPdf}
          onAction={() => window.location.href = `/decks/${deckId}/import`}
        />
      ) : (
        <ul className="space-y-3" role="list">
          {cards.map((card) => (
            <li key={card.id}>
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{card.front}</p>
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{card.back}</p>
                    {card.sourceSection && (
                      <Badge variant="muted" className="mt-2">{card.sourceSection}</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    className="shrink-0 text-xs"
                    disabled={deletingId === card.id}
                    onClick={() => handleDeleteCard(card.id)}
                  >
                    {t.common.remove}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
