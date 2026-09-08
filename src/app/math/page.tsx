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

interface LessonStep {
  id: string;
  title: string;
  explanation: string;
  example: string;
  tip: string;
}

type Phase =
  | "upload"
  | "choose"
  | "learn"
  | "learnDone"
  | "practice"
  | "results";

export default function MathPracticePage() {
  const { t, fmt, locale } = useLocale();

  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [preparing, setPreparing] = useState<"learn" | "practice" | null>(null);
  const [language, setLanguage] = useState<AppLocale>(locale);

  // Imported PDF text — kept in memory until user picks Learn or Practice
  const [documentText, setDocumentText] = useState("");

  // Practice data
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [source, setSource] = useState<"extracted" | "generated">("extracted");
  const [topic, setTopic] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/png");
  const [grading, setGrading] = useState(false);
  const [currentEval, setCurrentEval] = useState<Evaluation | null>(null);
  const [results, setResults] = useState<ExerciseResult[]>([]);

  // Learn data
  const [lessonSteps, setLessonSteps] = useState<LessonStep[]>([]);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [helpBusy, setHelpBusy] = useState(false);
  const [extraHelp, setExtraHelp] = useState<string | null>(null);
  const [quizQuestion, setQuizQuestion] = useState<string | null>(null);
  const [quizHint, setQuizHint] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);

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
      if (!data.text?.trim()) throw new Error(t.math.failedExtract);

      setDocumentText(data.text);
      setExercises([]);
      setLessonSteps([]);
      setResults([]);
      setTopic("");
      setPhase("choose");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.math.failedExtract);
    } finally {
      setExtracting(false);
    }
  }

  async function startLearn() {
    setError(null);
    setPreparing("learn");
    try {
      const res = await fetch("/api/math/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: documentText, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.math.failedLesson);
      if (!data.steps?.length) throw new Error(t.math.failedLesson);

      setLessonSteps(data.steps);
      setTopic(data.topic ?? "");
      setLessonIndex(0);
      setExtraHelp(null);
      setQuizQuestion(null);
      setQuizHint(null);
      setPhase("learn");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.math.failedLesson);
    } finally {
      setPreparing(null);
    }
  }

  async function startPractice() {
    setError(null);
    setPreparing("practice");
    try {
      const res = await fetch("/api/math/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: documentText, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.math.failedExercises);
      if (!data.exercises?.length) throw new Error(t.math.noExercises);

      setExercises(data.exercises);
      setSource(data.source === "generated" ? "generated" : "extracted");
      setTopic(data.topic ?? topic);
      setCurrentIndex(0);
      setResults([]);
      setUserAnswer("");
      setCurrentEval(null);
      clearImage();
      setPhase("practice");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.math.failedExercises);
    } finally {
      setPreparing(null);
    }
  }

  async function requestLessonHelp(action: "deeper" | "quiz") {
    const step = lessonSteps[lessonIndex];
    if (!step) return;

    setHelpBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/math/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: documentText,
          language,
          action,
          step,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.math.failedLesson);

      if (action === "deeper") {
        setExtraHelp(data.content ?? "");
        setQuizQuestion(null);
        setQuizHint(null);
      } else {
        setQuizQuestion(data.quizQuestion || data.content || "");
        setQuizHint(data.quizHint || null);
        setExtraHelp(data.content && data.quizQuestion ? data.content : null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.math.failedLesson);
    } finally {
      setHelpBusy(false);
    }
  }

  function handleNextLessonStep() {
    setExtraHelp(null);
    setQuizQuestion(null);
    setQuizHint(null);
    if (lessonIndex < lessonSteps.length - 1) {
      setLessonIndex((i) => i + 1);
    } else {
      setPhase("learnDone");
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageMimeType(file.type || "image/png");

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
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

  function handleReset() {
    setPhase("upload");
    setDocumentText("");
    setExercises([]);
    setLessonSteps([]);
    setResults([]);
    setCurrentIndex(0);
    setLessonIndex(0);
    setUserAnswer("");
    setCurrentEval(null);
    setExtraHelp(null);
    setQuizQuestion(null);
    setQuizHint(null);
    setTopic("");
    clearImage();
    setError(null);
  }

  const answeredResults = results.filter((r) => r.evaluation);
  const totalScore = answeredResults.length
    ? Math.round(
        answeredResults.reduce((sum, r) => sum + (r.evaluation?.scorePercent ?? 0), 0) /
          answeredResults.length
      )
    : 0;

  const currentStep = lessonSteps[lessonIndex];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          ← {t.common.backToModules}
        </Link>
        <h1 className="mt-2 text-3xl text-[var(--color-text-primary)]">{t.math.title}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.math.subtitle}</p>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

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

      {phase === "choose" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl text-[var(--color-text-primary)]">{t.math.chooseTitle}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.math.chooseSubtitle}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="flex flex-col">
              <h3 className="text-lg text-[var(--color-text-primary)]">{t.math.chooseLearnTitle}</h3>
              <p className="mt-2 flex-1 text-sm text-[var(--color-text-secondary)]">
                {t.math.chooseLearnDesc}
              </p>
              <Button
                className="mt-4 w-full"
                onClick={startLearn}
                loading={preparing === "learn"}
                disabled={preparing !== null}
              >
                {preparing === "learn" ? t.math.preparingLearn : t.math.chooseLearnTitle}
              </Button>
            </Card>

            <Card className="flex flex-col">
              <h3 className="text-lg text-[var(--color-text-primary)]">{t.math.choosePracticeTitle}</h3>
              <p className="mt-2 flex-1 text-sm text-[var(--color-text-secondary)]">
                {t.math.choosePracticeDesc}
              </p>
              <Button
                className="mt-4 w-full"
                variant="secondary"
                onClick={startPractice}
                loading={preparing === "practice"}
                disabled={preparing !== null}
              >
                {preparing === "practice" ? t.math.preparingPractice : t.math.choosePracticeTitle}
              </Button>
            </Card>
          </div>

          <Button variant="ghost" onClick={handleReset}>
            {t.math.tryNewPdf}
          </Button>
        </div>
      )}

      {phase === "learn" && currentStep && (
        <div className="space-y-4">
          <ProgressBar
            value={lessonIndex + 1}
            max={lessonSteps.length}
            label={fmt(t.math.stepOf, {
              current: lessonIndex + 1,
              total: lessonSteps.length,
            })}
          />

          {topic && <Badge variant="accent">{topic}</Badge>}

          <Card>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              {fmt(t.math.stepLabel, { num: lessonIndex + 1 })}
            </p>
            <h2 className="text-xl text-[var(--color-text-primary)]">{currentStep.title}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
              {currentStep.explanation}
            </p>
          </Card>

          {currentStep.example && (
            <Card className="!bg-[var(--color-surface)]">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                {t.math.exampleLabel}
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
                {currentStep.example}
              </p>
            </Card>
          )}

          {currentStep.tip && (
            <Alert variant="warning">
              <span className="font-medium">{t.math.tipLabel}: </span>
              {currentStep.tip}
            </Alert>
          )}

          {extraHelp && (
            <Card>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
                {extraHelp}
              </p>
            </Card>
          )}

          {quizQuestion && (
            <Card className="border-[var(--color-accent)]/40">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{quizQuestion}</p>
              {quizHint && (
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  {t.math.quizHint}: {quizHint}
                </p>
              )}
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleNextLessonStep}>
              {lessonIndex < lessonSteps.length - 1 ? t.math.gotIt : t.math.finishLesson}
            </Button>
            <Button
              variant="secondary"
              onClick={() => requestLessonHelp("deeper")}
              loading={helpBusy}
            >
              {helpBusy ? t.math.helping : t.math.explainMore}
            </Button>
            <Button
              variant="ghost"
              onClick={() => requestLessonHelp("quiz")}
              disabled={helpBusy}
            >
              {t.math.quizMe}
            </Button>
          </div>
        </div>
      )}

      {phase === "learnDone" && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl text-[var(--color-text-primary)]">{t.math.lessonComplete}</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {t.math.lessonCompleteDesc}
            </p>
            {topic && (
              <Badge variant="accent" className="mt-3">
                {topic}
              </Badge>
            )}
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button onClick={startPractice} loading={preparing === "practice"}>
              {preparing === "practice" ? t.math.preparingPractice : t.math.goPractice}
            </Button>
            <Button variant="secondary" onClick={() => setPhase("choose")}>
              {t.math.backToChoice}
            </Button>
            <Button variant="ghost" onClick={handleReset}>
              {t.math.tryNewPdf}
            </Button>
          </div>
        </div>
      )}

      {phase === "practice" && exercises[currentIndex] && (
        <div className="space-y-4">
          <ProgressBar
            value={currentIndex + 1}
            max={exercises.length}
            label={fmt(t.math.exerciseOf, { current: currentIndex + 1, total: exercises.length })}
          />

          {topic && (
            <div className="flex items-center gap-2">
              <Badge variant="accent">{topic}</Badge>
              <Badge variant={source === "extracted" ? "default" : "warning"}>
                {source === "extracted" ? t.math.fromPdf : t.math.aiGenerated}
              </Badge>
            </div>
          )}

          <Card>
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              {fmt(t.math.exerciseLabel, { num: currentIndex + 1 })}
            </h2>
            <p className="whitespace-pre-wrap text-[var(--color-text-primary)] leading-relaxed">
              {exercises[currentIndex].problem}
            </p>
          </Card>

          {!currentEval && (
            <Card>
              <h3 className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">
                {t.math.yourSolution}
              </h3>

              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder={t.math.typeSolution}
                rows={4}
                className="w-full resize-y rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
              />

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
                      className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-[var(--color-danger)] text-xs text-white"
                      aria-label={t.common.remove}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={() => imageInputRef.current?.click()}>
                    {t.math.uploadPhoto}
                  </Button>
                )}
              </div>

              <p className="mt-2 text-xs text-[var(--color-text-muted)]">{t.math.answerHint}</p>

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

          {currentEval && (
            <Card>
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

              {currentEval.modelSolution && (
                <div className="rounded-lg bg-[var(--color-surface)] p-4">
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    {t.math.modelSolution}
                  </h4>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
                    {currentEval.modelSolution}
                  </p>
                </div>
              )}

              <div className="mt-4">
                <Button onClick={handleNext}>
                  {currentIndex < exercises.length - 1 ? t.math.nextExercise : t.math.seeResults}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {phase === "results" && (
        <div className="space-y-6">
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
                  {totalScore >= 70
                    ? t.quiz.strong
                    : totalScore >= 40
                      ? t.quiz.gettingThere
                      : t.quiz.keepPracticing}
                </p>
              </div>
            </div>
          </Card>

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
                      <span className="font-medium">
                        {fmt(t.math.exerciseLabel, { num: i + 1 })}:
                      </span>{" "}
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

          <div className="flex gap-3">
            <Button onClick={handleReset}>{t.math.tryNewPdf}</Button>
            <Link href="/">
              <Button variant="secondary">{t.common.backToModules}</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
