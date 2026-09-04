import { formatAiError, generateJson } from "@/lib/gemini";

export interface GeneratedFlashcard {
  front: string;
  back: string;
}

export interface GenerateOptions {
  cardsPerChunk?: number;
  style?: "qa" | "term";
  language?: "en" | "sv";
}

export interface GenerateApiError {
  message: string;
  status: number;
}

const SYSTEM_PROMPT = `You create study flashcards from educational text.
Return valid JSON only.
Rules:
- Front: clear question or term prompt
- Back: concise answer (1-3 sentences max)
- No markdown, no bullet lists on the back unless essential
- Cover key concepts, definitions, and relationships
- Avoid duplicate or near-duplicate cards`;

function buildUserPrompt(text: string, count: number, style: string, language: "en" | "sv") {
  const styleHint =
    style === "term"
      ? language === "sv"
        ? "Använd term på framsidan och definition på baksidan."
        : "Use term on front, definition on back."
      : language === "sv"
        ? "Använd fråga på framsidan och svar på baksidan."
        : "Use question on front, answer on back.";

  const languageRule =
    language === "sv"
      ? "Write every flashcard in Swedish. Use clear, natural Swedish suitable for studying."
      : "Write every flashcard in English.";

  return `Create ${count} flashcards from this text. ${styleHint}
${languageRule}

TEXT:
${text}

Respond with JSON: { "cards": [ { "front": "...", "back": "..." } ] }`;
}

export function formatOpenAiError(error: unknown, language: "en" | "sv" = "en"): GenerateApiError {
  return formatAiError(error, language);
}

export async function generateFlashcardsFromText(
  text: string,
  options: GenerateOptions = {}
): Promise<GeneratedFlashcard[]> {
  const count = options.cardsPerChunk ?? 8;
  const style = options.style ?? "qa";
  const language = options.language ?? "sv";

  const parsed = await generateJson<{ cards?: GeneratedFlashcard[] }>(
    SYSTEM_PROMPT,
    buildUserPrompt(text, count, style, language)
  );

  const cards = parsed.cards ?? [];

  return cards
    .filter((c) => c.front?.trim() && c.back?.trim())
    .map((c) => ({
      front: c.front.trim(),
      back: c.back.trim(),
    }));
}
