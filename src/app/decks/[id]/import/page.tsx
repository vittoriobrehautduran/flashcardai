"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { FileUpload } from "@/components/ui/FileUpload";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/messages";

interface TextChunk {
  index: number;
  text: string;
}

interface GeneratedCard {
  front: string;
  back: string;
  selected: boolean;
}

type Step = "upload" | "preview" | "generating" | "review";

export default function ImportPage() {
  const { t, fmt, locale } = useLocale();
  const params = useParams();
  const router = useRouter();
  const deckId = params.id as string;

  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [fullText, setFullText] = useState("");
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [previewText, setPreviewText] = useState("");
  const [cardsPerChunk, setCardsPerChunk] = useState(8);
  const [cardLanguage, setCardLanguage] = useState<AppLocale>(locale);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [genProgress, setGenProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [ocrNote, setOcrNote] = useState<string | null>(null);

  async function handleFileSelect(file: File) {
    setError(null);
    setOcrNote(null);
    setExtracting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/pdf/extract", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? t.import.failedExtract);

      setFullText(data.text);
      setChunks(data.chunks);
      setPreviewText(data.text.slice(0, 3000));
      setCardLanguage(locale);

      if (data.usedOcr) {
        if (data.usedGeminiVision) {
          setOcrNote(t.import.ocrGemini);
        } else if (data.ocrPages?.length === data.pageCount) {
          setOcrNote(t.import.ocrScanned);
        } else {
          setOcrNote(fmt(t.import.ocrUsed, { count: data.ocrPages?.length ?? 0 }));
        }
      }

      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.import.failedExtract);
    } finally {
      setExtracting(false);
    }
  }

  async function handleGenerate() {
    setError(null);
    setStep("generating");
    setGenProgress(0);

    const textToUse = previewText.trim() || fullText;
    const chunksToProcess =
      chunks.length > 1 ? chunks : [{ index: 0, text: textToUse }];

    const allCards: GeneratedCard[] = [];

    for (let i = 0; i < chunksToProcess.length; i++) {
      const chunk = chunksToProcess[i];
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: chunk.text,
            chunkIndex: chunk.index,
            cardsPerChunk,
            style: "qa",
            language: cardLanguage,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t.import.failedGenerate);

        for (const card of data.cards) {
          allCards.push({ front: card.front, back: card.back, selected: true });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t.import.failedGenerate);
        setStep("preview");
        return;
      }

      setGenProgress(Math.round(((i + 1) / chunksToProcess.length) * 100));

      // Free-tier Gemini allows ~10 requests/min — pace multi-chunk generation.
      if (i < chunksToProcess.length - 1) {
        await new Promise((r) => setTimeout(r, 7000));
      }
    }

    setGeneratedCards(allCards);
    setStep("review");
  }

  async function handleSave() {
    const selected = generatedCards.filter((c) => c.selected);
    if (selected.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/decks/${deckId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: selected.map((c) => ({ front: c.front, back: c.back })),
        }),
      });

      if (!res.ok) throw new Error(t.import.failedSave);
      router.push(`/decks/${deckId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.import.failedSave);
    } finally {
      setSaving(false);
    }
  }

  function toggleCard(index: number) {
    setGeneratedCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c))
    );
  }

  const selectedCount = generatedCards.filter((c) => c.selected).length;

  return (
    <div>
      <nav className="mb-4 text-sm text-[var(--color-text-muted)]">
        <Link href="/" className="text-[var(--color-text-secondary)] no-underline hover:text-[var(--color-text-primary)]">
          {t.nav.decks}
        </Link>
        <span className="mx-2">›</span>
        <Link href={`/decks/${deckId}`} className="text-[var(--color-text-secondary)] no-underline hover:text-[var(--color-text-primary)]">
          {t.common.deck}
        </Link>
        <span className="mx-2">›</span>
        <span>{t.import.breadcrumb}</span>
      </nav>

      <h1 className="mb-2 text-3xl text-[var(--color-text-primary)]">{t.import.title}</h1>
      <p className="mb-8 text-sm text-[var(--color-text-secondary)]">{t.import.subtitle}</p>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {step === "upload" && (
        <FileUpload
          onFileSelect={handleFileSelect}
          disabled={extracting}
          label={extracting ? t.import.extractingOcr : t.import.uploadLabel}
          hint={t.import.uploadHint}
        />
      )}

      {step === "preview" && (
        <div className="space-y-6">
          {ocrNote && <Alert variant="success">{ocrNote}</Alert>}
          <Alert variant="info">
            {chunks.length > 1
              ? fmt(t.import.longDocument, { count: chunks.length })
              : t.import.textExtracted}
            {fullText.length > 3000 && t.import.trimHint}
          </Alert>

          <div>
            <label htmlFor="preview-text" className="mb-2 block text-sm font-medium">
              {t.import.previewLabel}
            </label>
            <textarea
              id="preview-text"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {fmt(t.import.charactersTotal, { count: fullText.length.toLocaleString() })}
            </p>
          </div>

          <div>
            <label htmlFor="cards-per-chunk" className="mb-2 block text-sm font-medium">
              {t.import.cardsPerSection}
            </label>
            <select
              id="cards-per-chunk"
              value={cardsPerChunk}
              onChange={(e) => setCardsPerChunk(Number(e.target.value))}
              className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm"
            >
              <option value={5}>5</option>
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={15}>15</option>
            </select>
          </div>

          <div>
            <p className="mb-2 block text-sm font-medium">{t.import.flashcardLanguage}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCardLanguage("sv")}
                className={[
                  "rounded-lg border px-4 py-2 text-sm font-medium min-h-9",
                  cardLanguage === "sv"
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                    : "border-[var(--color-border-strong)] bg-[var(--color-surface-raised)]",
                ].join(" ")}
              >
                {t.import.languageSv}
              </button>
              <button
                type="button"
                onClick={() => setCardLanguage("en")}
                className={[
                  "rounded-lg border px-4 py-2 text-sm font-medium min-h-9",
                  cardLanguage === "en"
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                    : "border-[var(--color-border-strong)] bg-[var(--color-surface-raised)]",
                ].join(" ")}
              >
                {t.import.languageEn}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("upload")}>{t.import.back}</Button>
            <Button onClick={handleGenerate}>{t.import.generate}</Button>
          </div>
        </div>
      )}

      {step === "generating" && (
        <Card>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{t.import.generating}</p>
          <ProgressBar value={genProgress} label={t.common.progress} />
        </Card>
      )}

      {step === "review" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {fmt(t.import.selectedCount, { selected: selectedCount, total: generatedCards.length })}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep("preview")}>{t.import.back}</Button>
              <Button onClick={handleSave} loading={saving} disabled={selectedCount === 0}>
                {fmt(t.import.saveCards, { count: selectedCount })}
              </Button>
            </div>
          </div>

          <ul className="space-y-3" role="list">
            {generatedCards.map((card, index) => (
              <li key={index}>
                <Card className={card.selected ? "" : "opacity-50 border-dashed"}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={card.selected}
                      onChange={() => toggleCard(index)}
                      className="mt-1 size-4 rounded border-[var(--color-border-strong)]"
                    />
                    <div>
                      <p className="text-sm font-medium">{card.front}</p>
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{card.back}</p>
                    </div>
                  </label>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
