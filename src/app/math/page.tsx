"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { FileUpload } from "@/components/ui/FileUpload";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/messages";

interface Exercise {
  id: string;
  problem: string;
  hasSolution: boolean;
  solution?: string;
}

interface Evaluation {
  scorePercent: number;
  isCorrect: boolean;
  feedback: string;
  modelSolution: string;
}

interface ExerciseResult {
  exercise: Exercise;
  evaluation: Evaluation | null;
  userAnswer: string;
  hadImage: boolean;
}

type Phase = "upload" | "practice" | "results";

export default function MathPracticePage() {
  const { t, fmt, locale } = useLocale();

  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [language, setLanguage] = useState<AppLocale>(locale);

  // Exercise data from PDF
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [source, setSource] = useState<"extracted" | "generated">("extracted");
  const [topic, setTopic] = useState("");

  // Practice state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/png");
  const [grading, setGrading] = useState(false);
  const [currentEval, setCurrentEval] = useState<Evaluation | null>(null);
  const [results, setResults] = useState<ExerciseResult[]>([]);

  const imageInputRef = useRef<HTMLInputElement>(null);

  // Upload PDF and extract exercises
  async function handleFileSelect(file: File) {
    setError(null);
    setExtracting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", language);

      const res = await fetch("/api/math/extract", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? t.math.failedExtract);

      if (!data.exercises?.length) {
        throw new Error(t.math.noExercises);
      }

      setExercises(data.exercises);
      setSource(data.source);
      setTopic(data.topic ?? "");
      setCurrentIndex(0);
      setResults([]);
      setPhase("practice");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.math.failedExtract);
    } finally {
      setExtracting(false);
    }
  }

  // Handle image upload for handwritten solution
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageMimeType(file.type || "image/png");

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      // Strip the data URL prefix to get pure base64
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImagePreview(null);
    setImageBase64(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  // Submit answer for grading
  async function handleSubmit() {
    if (!userAnswer.trim() && !imageBase64) return;

    setGrading(true);
    setError(null);

    try {
      const currentExercise = exercises[currentIndex];
      const res = await fetch("/api/math/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise: currentExercise.problem,
          userAnswer: userAnswer.trim() || undefined,
          userImageBase64: imageBase64 || undefined,
          imageMimeType,
          language,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.math.failedGrade);

      const evaluation: Evaluation = {
        scorePercent: data.scorePercent,
        isCorrect: data.isCorrect,
        feedback: data.feedback,
        modelSolution: data.modelSolution,
      };

      setCurrentEval(evaluation);

      // Save result
      setResults((prev) => [
        ...prev,
        {
          exercise: currentExercise,
          evaluation,
          userAnswer: userAnswer.trim(),
          hadImage: Boolean(imageBase64),
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.math.failedGrade);
    } finally {
      setGrading(false);
    }
  }

  // Move to next exercise or show results
  function handleNext() {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex((i) => i + 1);
      setUserAnswer("");
      setCurrentEval(null);
      clearImage();
    } else {
      setPhase("results");
    }
  }

  // Skip current exercise
  function handleSkip() {
    setResults((prev) => [
      ...prev,
      {
        exercise: exercises[currentIndex],
        evaluation: null,
        userAnswer: "",
        hadImage: false,
      },
    ]);
    handleNext();
  }

  // Start over with a new PDF
  function handleReset() {
    setPhase("upload");
    setExercises([]);
    setResults([]);
    setCurrentIndex(0);
    setUserAnswer("");
    setCurrentEval(null);
    clearImage();
    setError(null);
  }

  // Calculate total score from results
  const answeredResults = results.filter((r) => r.evaluation);
  const totalScore = answeredResults.length
    ? Math.round(
        answeredResults.reduce((sum, r) => sum + (r.evaluation?.scorePercent ?? 0), 0) /
          answeredResults.length
      )
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          ← {t.common.backToDecks}
        </Link>
        <h1 className="mt-2 text-3xl text-[var(--color-text-primary)]">{t.math.title}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.math.subtitle}</p>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Upload Phase */}
      {phase === "upload" && (
        <div className="space-y-6">
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">
                {t.math.exerciseLanguage}
              </label>
              <div className="flex gap-2">
                <button
                  className={`rounded-lg px-3 py-1.5 text-sm ${language === "sv" ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-surface)] text-[var(--color-text-secondary)]"}`}
                  onClick={() => setLanguage("sv")}
                >
                  {t.import.languageSv}
                </button>
                <button
                  className={`rounded-lg px-3 py-1.5 text-sm ${language === "en" ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-surface)] text-[var(--color-text-secondary)]"}`}
                  onClick={() => setLanguage("en")}
                >
                  {t.import.languageEn}
                </button>
              </div>
            </div>

            <FileUpload
              onFileSelect={handleFileSelect}
              disabled={extracting}
              label={t.math.uploadLabel}
              hint={t.math.uploadHint}
            />

            {extracting && (
              <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)] animate-pulse">
                {t.math.extracting}
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Practice Phase */}
      {phase === "practice" && exercises[currentIndex] && (
        <div className="space-y-4">
          {/* Progress bar */}
          <ProgressBar
            value={currentIndex + 1}
            max={exercises.length}
            label={fmt(t.math.exerciseOf, { current: currentIndex + 1, total: exercises.length })}
          />

          {/* Topic badge */}
          {topic && (
            <div className="flex items-center gap-2">
              <Badge variant="accent">{topic}</Badge>
              <Badge variant={source === "extracted" ? "default" : "warning"}>
                {source === "extracted" ? t.math.fromPdf : t.math.aiGenerated}
              </Badge>
            </div>
          )}

          {/* Exercise card */}
          <Card>
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              {fmt(t.math.exerciseLabel, { num: currentIndex + 1 })}
            </h2>
            <p className="whitespace-pre-wrap text-[var(--color-text-primary)] leading-relaxed">
              {exercises[currentIndex].problem}
            </p>
          </Card>

          {/* Answer input (only show if not graded yet) */}
          {!currentEval && (
            <Card>
              <h3 className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">
                {t.math.yourSolution}
              </h3>

              {/* Text input */}
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder={t.math.typeSolution}
                rows={4}
                className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-y"
              />

              {/* Image upload */}
              <div className="mt-3">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImageSelect}
                />

                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt={t.math.photoPreview}
                      className="max-h-48 rounded-lg border border-[var(--color-border)]"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-[var(--color-danger)] text-white text-xs"
                      aria-label={t.common.remove}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="8.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M21 17l-5-5-3 3-2-2-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t.math.uploadPhoto}
                  </Button>
                )}
              </div>

              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                {t.math.answerHint}
              </p>

              {/* Submit / Skip buttons */}
              <div className="mt-4 flex gap-3">
                <Button
                  onClick={handleSubmit}
                  loading={grading}
                  disabled={!userAnswer.trim() && !imageBase64}
                >
                  {grading ? t.math.grading : t.math.checkSolution}
                </Button>
                <Button variant="ghost" onClick={handleSkip} disabled={grading}>
                  {t.math.skip}
                </Button>
              </div>
            </Card>
          )}

          {/* Evaluation result */}
          {currentEval && (
            <Card>
              {/* Score */}
              <div className="mb-4 flex items-center gap-3">
                <div
                  className={`flex size-14 items-center justify-center rounded-full text-lg font-bold ${
                    currentEval.scorePercent >= 70
                      ? "bg-[var(--color-success-muted)] text-[var(--color-success)]"
                      : currentEval.scorePercent >= 40
                        ? "bg-[var(--color-warning-muted)] text-[var(--color-warning)]"
                        : "bg-[var(--color-danger-muted)] text-[var(--color-danger)]"
                  }`}
                >
                  {currentEval.scorePercent}%
                </div>
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {currentEval.isCorrect ? t.math.correct : t.math.needsWork}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {currentEval.feedback}
                  </p>
                </div>
              </div>

              {/* Model solution */}
              {currentEval.modelSolution && (
                <div className="rounded-lg bg-[var(--color-surface)] p-4">
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    {t.math.modelSolution}
                  </h4>
                  <p className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)] leading-relaxed">
                    {currentEval.modelSolution}
                  </p>
                </div>
              )}

              {/* Next button */}
              <div className="mt-4">
                <Button onClick={handleNext}>
                  {currentIndex < exercises.length - 1 ? t.math.nextExercise : t.math.seeResults}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Results Phase */}
      {phase === "results" && (
        <div className="space-y-6">
          {/* Summary card */}
          <Card>
            <h2 className="text-xl text-[var(--color-text-primary)]">{t.math.practiceComplete}</h2>

            <div className="mt-4 flex items-center gap-4">
              <div
                className={`flex size-20 items-center justify-center rounded-full text-2xl font-bold ${
                  totalScore >= 70
                    ? "bg-[var(--color-success-muted)] text-[var(--color-success)]"
                    : totalScore >= 40
                      ? "bg-[var(--color-warning-muted)] text-[var(--color-warning)]"
                      : "bg-[var(--color-danger-muted)] text-[var(--color-danger)]"
                }`}
              >
                {totalScore}%
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {fmt(t.math.answeredOf, {
                    answered: answeredResults.length,
                    total: exercises.length,
                  })}
                </p>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {totalScore >= 70 ? t.quiz.strong : totalScore >= 40 ? t.quiz.gettingThere : t.quiz.keepPracticing}
                </p>
              </div>
            </div>
          </Card>

          {/* Per-exercise breakdown */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{t.math.breakdown}</h3>
            {results.map((r, i) => (
              <Card key={r.exercise.id}>
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      r.evaluation
                        ? r.evaluation.scorePercent >= 70
                          ? "bg-[var(--color-success-muted)] text-[var(--color-success)]"
                          : r.evaluation.scorePercent >= 40
                            ? "bg-[var(--color-warning-muted)] text-[var(--color-warning)]"
                            : "bg-[var(--color-danger-muted)] text-[var(--color-danger)]"
                        : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {r.evaluation ? `${r.evaluation.scorePercent}%` : "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--color-text-primary)]">
                      <span className="font-medium">{fmt(t.math.exerciseLabel, { num: i + 1 })}:</span>{" "}
                      {r.exercise.problem.slice(0, 120)}
                      {r.exercise.problem.length > 120 ? "…" : ""}
                    </p>
                    {r.evaluation?.feedback && (
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {r.evaluation.feedback}
                      </p>
                    )}
                    {!r.evaluation && (
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t.math.skipped}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button onClick={handleReset}>{t.math.tryNewPdf}</Button>
            <Link href="/">
              <Button variant="secondary">{t.common.backToDecks}</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
