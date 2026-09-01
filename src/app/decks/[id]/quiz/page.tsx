"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  buildQuizQuestions,
  canRunMultipleChoiceQuiz,
  getQuizQuestionCountOptions,
  type QuizQuestion,
} from "@/lib/quiz";
import { useLocale } from "@/components/providers/LocaleProvider";

type Phase = "setup" | "playing" | "results";

interface QuizCard {
  id: string;
  front: string;
  back: string;
}

interface SavedQuizSession {
  id: string;
  questions: QuizQuestion[];
  questionCount: number;
  currentIndex: number;
  score: number;
  wrongCardIds: string[];
}

function wrongQuestionsFromIds(questions: QuizQuestion[], ids: string[]) {
  const idSet = new Set(ids);
  return questions.filter((q) => idSet.has(q.cardId));
}

export default function QuizPage() {
  const { t, fmt } = useLocale();
  const params = useParams();
  const deckId = params.id as string;

  const [deckName, setDeckName] = useState("");
  const [allCards, setAllCards] = useState<QuizCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("setup");
  const [questionCount, setQuestionCount] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedSession, setSavedSession] = useState<SavedQuizSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState<QuizQuestion[]>([]);
  const [wrongCardIds, setWrongCardIds] = useState<string[]>([]);

  const loadDeck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/decks/${deckId}`);
      if (!res.ok) throw new Error(t.quiz.failedLoad);
      const data = await res.json();
      setDeckName(data.deck.name);
      setAllCards(data.cards);

      const options = getQuizQuestionCountOptions(data.cards.length);
      if (options.length > 0) {
        setQuestionCount(options[options.length - 1]);
      }

      const sessionRes = await fetch(`/api/decks/${deckId}/quiz/session`);
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        if (sessionData.session) {
          setSavedSession(sessionData.session);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.quiz.failedLoad);
    } finally {
      setLoading(false);
    }
  }, [deckId, t]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  async function persistQuizSession(
    nextIndex: number,
    nextScore: number,
    nextWrongIds: string[],
    complete = false
  ) {
    if (!sessionId) return;

    await fetch(`/api/decks/${deckId}/quiz/session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        currentIndex: nextIndex,
        score: nextScore,
        wrongCardIds: nextWrongIds,
        complete,
      }),
    });
  }

  async function startNewQuiz() {
    const built = buildQuizQuestions(allCards, questionCount);
    const res = await fetch(`/api/decks/${deckId}/quiz/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: built, questionCount }),
    });

    if (!res.ok) {
      setError(t.quiz.failedLoad);
      return;
    }

    const data = await res.json();
    setSessionId(data.session.id);
    setQuestions(data.session.questions);
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setScore(0);
    setWrongAnswers([]);
    setWrongCardIds([]);
    setSavedSession(null);
    setPhase("playing");
  }

  function resumeQuiz() {
    if (!savedSession) return;

    setSessionId(savedSession.id);
    setQuestions(savedSession.questions);
    setCurrentIndex(savedSession.currentIndex);
    setScore(savedSession.score);
    setWrongCardIds(savedSession.wrongCardIds);
    setWrongAnswers(wrongQuestionsFromIds(savedSession.questions, savedSession.wrongCardIds));
    setSelectedOptionId(null);
    setSavedSession(null);
    setPhase("playing");
  }

  async function abandonSavedAndStartNew() {
    if (savedSession) {
      await fetch(`/api/decks/${deckId}/quiz/session`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: savedSession.id }),
      });
      setSavedSession(null);
    }
    await startNewQuiz();
  }

  function handleSelect(optionId: string, isCorrect: boolean, question: QuizQuestion) {
    if (selectedOptionId) return;

    setSelectedOptionId(optionId);
    if (isCorrect) {
      setScore((s) => s + 1);
    } else {
      setWrongAnswers((prev) => [...prev, question]);
      setWrongCardIds((prev) => [...prev, question.cardId]);
    }
  }

  async function handleNext() {
    const nextScore = score;
    const nextWrongIds = wrongCardIds;
    const isLast = currentIndex + 1 >= questions.length;

    if (isLast) {
      await persistQuizSession(currentIndex, nextScore, nextWrongIds, true);
      setSessionId(null);
      setPhase("results");
      return;
    }

    const nextIndex = currentIndex + 1;
    await persistQuizSession(nextIndex, nextScore, nextWrongIds);
    setCurrentIndex(nextIndex);
    setSelectedOptionId(null);
  }

  async function restartQuiz() {
    if (sessionId) {
      await fetch(`/api/decks/${deckId}/quiz/session`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    }
    setPhase("setup");
    setQuestions([]);
    setSessionId(null);
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setScore(0);
    setWrongAnswers([]);
    setWrongCardIds([]);
    await loadDeck();
  }

  const currentQuestion = questions[currentIndex];
  const progress =
    questions.length > 0 ? ((currentIndex + (selectedOptionId ? 1 : 0)) / questions.length) * 100 : 0;
  const countOptions = getQuizQuestionCountOptions(allCards.length);
  const percentScore =
    questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[var(--color-border)]" />
        <div className="h-64 rounded-xl bg-[var(--color-border)]" />
      </div>
    );
  }

  if (!canRunMultipleChoiceQuiz(allCards)) {
    return (
      <div>
        <nav className="mb-4 text-sm text-[var(--color-text-muted)]">
          <Link href={`/decks/${deckId}`} className="text-[var(--color-text-secondary)] no-underline">
            ← {t.common.backToDeck}
          </Link>
        </nav>
        <EmptyState
          title={t.quiz.needMoreTitle}
          description={t.quiz.needMoreDescription}
          actionLabel={t.common.backToDeck}
          onAction={() => window.location.href = `/decks/${deckId}`}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <nav className="mb-4 text-sm text-[var(--color-text-muted)]" aria-label="Breadcrumb">
        <Link href="/" className="text-[var(--color-text-secondary)] no-underline hover:text-[var(--color-text-primary)]">
          {t.nav.decks}
        </Link>
        <span className="mx-2">›</span>
        <Link href={`/decks/${deckId}`} className="text-[var(--color-text-secondary)] no-underline hover:text-[var(--color-text-primary)]">
          {deckName}
        </Link>
        <span className="mx-2">›</span>
        <span>{t.quiz.breadcrumb}</span>
      </nav>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {phase === "setup" && (
        <>
          <h1 className="text-3xl text-[var(--color-text-primary)]">{t.quiz.title}</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t.quiz.subtitle}</p>

          {savedSession && (
            <Card className="mt-6 border-[var(--color-accent)]/30 bg-[var(--color-accent-muted)]/40">
              <h2 className="text-sm font-medium text-[var(--color-text-primary)]">{t.quiz.resumeTitle}</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {fmt(t.quiz.resumeDescription, {
                  current: savedSession.currentIndex + 1,
                  total: savedSession.questionCount,
                })}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={resumeQuiz}>{t.quiz.resumeButton}</Button>
                <Button variant="secondary" onClick={abandonSavedAndStartNew}>{t.quiz.startNew}</Button>
              </div>
            </Card>
          )}

          <Card className="mt-8">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{t.quiz.questionCount}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {countOptions.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={[
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-9",
                    questionCount === count
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                      : "border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]",
                  ].join(" ")}
                >
                  {count === allCards.length ? fmt(t.quiz.allCount, { count }) : count}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs text-[var(--color-text-muted)]">
              {fmt(t.quiz.cardsAvailable, { count: allCards.length })}
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">{t.quiz.sessionSaved}</p>

            <div className="mt-6 flex gap-2">
              <Link href={`/decks/${deckId}`}>
                <Button variant="secondary">{t.common.cancel}</Button>
              </Link>
              <Button onClick={startNewQuiz}>{t.quiz.startQuiz}</Button>
            </div>
          </Card>
        </>
      )}

      {phase === "playing" && currentQuestion && (
        <>
          <div className="mb-6">
            <ProgressBar
              value={progress}
              label={fmt(t.quiz.questionOf, { current: currentIndex + 1, total: questions.length })}
            />
          </div>

          <Card className="mb-6">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              {t.study.question}
            </p>
            <p className="mt-3 text-xl text-[var(--color-text-primary)] font-[family-name:var(--font-display)]">
              {currentQuestion.prompt}
            </p>
          </Card>

          <fieldset className="space-y-2">
            <legend className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">
              {t.quiz.pickAnswer}
            </legend>
            {currentQuestion.options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const showResult = selectedOptionId !== null;
              const isCorrectOption = option.isCorrect;

              let optionStyle =
                "border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]";

              if (showResult) {
                if (isCorrectOption) {
                  optionStyle = "border-[var(--color-success)] bg-[var(--color-success-muted)] text-[var(--color-success)]";
                } else if (isSelected) {
                  optionStyle = "border-[var(--color-danger)] bg-[var(--color-danger-muted)] text-[var(--color-danger)]";
                } else {
                  optionStyle = "border-[var(--color-border)] bg-[var(--color-surface)] opacity-60";
                }
              } else {
                optionStyle =
                  "border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-muted)]/40";
              }

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={selectedOptionId !== null}
                  onClick={() => handleSelect(option.id, option.isCorrect, currentQuestion)}
                  className={[
                    "w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                    "disabled:cursor-default min-h-[44px]",
                    optionStyle,
                  ].join(" ")}
                >
                  {option.text}
                </button>
              );
            })}
          </fieldset>

          {selectedOptionId && (
            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {currentQuestion.options.find((o) => o.id === selectedOptionId)?.isCorrect
                  ? t.quiz.correct
                  : fmt(t.quiz.correctAnswer, { answer: currentQuestion.correctAnswer })}
              </p>
              <Button onClick={handleNext}>
                {currentIndex + 1 < questions.length ? t.quiz.nextQuestion : t.quiz.seeResults}
              </Button>
            </div>
          )}
        </>
      )}

      {phase === "results" && (
        <div className="text-center">
          <h1 className="text-3xl text-[var(--color-text-primary)]">{t.quiz.complete}</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {fmt(t.quiz.scored, { score, total: questions.length })}
          </p>

          <Card className="mt-8">
            <p className="text-5xl font-[family-name:var(--font-display)] text-[var(--color-accent)]">
              {percentScore}%
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Badge variant={percentScore >= 80 ? "accent" : percentScore >= 50 ? "warning" : "default"}>
                {percentScore >= 80 ? t.quiz.strong : percentScore >= 50 ? t.quiz.gettingThere : t.quiz.keepPracticing}
              </Badge>
            </div>
          </Card>

          {wrongAnswers.length > 0 && (
            <div className="mt-8 text-left">
              <h2 className="text-lg text-[var(--color-text-primary)]">{t.quiz.reviewMistakes}</h2>
              <ul className="mt-4 space-y-3" role="list">
                {wrongAnswers.map((q) => (
                  <li key={q.cardId}>
                    <Card>
                      <p className="text-sm font-medium">{q.prompt}</p>
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{q.correctAnswer}</p>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Link href={`/decks/${deckId}`}>
              <Button variant="secondary">{t.common.backToDeck}</Button>
            </Link>
            <Button onClick={restartQuiz}>{t.quiz.tryAgain}</Button>
            <Link href={`/decks/${deckId}/study`}>
              <Button variant="secondary">{t.quiz.studySrs}</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
