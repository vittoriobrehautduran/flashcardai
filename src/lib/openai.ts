import OpenAI from "openai";

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
Return valid JSON only: an array of objects with "front" and "back" strings.
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
${text}`;
}

export function formatOpenAiError(error: unknown, language: "en" | "sv" = "en"): GenerateApiError {
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 500;
    const apiMessage = error.message ?? "OpenAI request failed";

    if (status === 401) {
      return {
        status,
        message:
          language === "sv"
            ? "Ogiltig OpenAI API-nyckel. Kontrollera OPENAI_API_KEY i .env.local."
            : "Invalid OpenAI API key. Check OPENAI_API_KEY in .env.local.",
      };
    }

    if (status === 429) {
      const lower = apiMessage.toLowerCase();
      if (lower.includes("credit") || lower.includes("billing") || lower.includes("quota")) {
        return {
          status,
          message:
            language === "sv"
              ? "Ditt OpenAI-konto har inga krediter kvar. Lägg till betalning eller förbetalda krediter på platform.openai.com/settings/organization/billing och försök igen."
              : "Your OpenAI account has no credits left. Add billing or prepaid credits at platform.openai.com/settings/organization/billing, then try again.",
        };
      }
      return {
        status,
        message:
          language === "sv"
            ? "OpenAI-gräns nådd. Vänta en stund och försök igen."
            : "OpenAI rate limit hit. Wait a moment and try again.",
      };
    }

    return { status, message: apiMessage };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: language === "sv" ? "Generering misslyckades" : "Generation failed" };
}

export async function generateFlashcardsFromText(
  text: string,
  options: GenerateOptions = {}
): Promise<GeneratedFlashcard[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your .env.local file.");
  }

  const client = new OpenAI({ apiKey });
  const count = options.cardsPerChunk ?? 8;
  const style = options.style ?? "qa";
  const language = options.language ?? "sv";

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${buildUserPrompt(text, count, style, language)}\n\nRespond with JSON: { "cards": [ { "front": "...", "back": "..." } ] }`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Empty response from OpenAI");
  }

  const parsed = JSON.parse(raw) as { cards?: GeneratedFlashcard[] };
  const cards = parsed.cards ?? [];

  return cards
    .filter((c) => c.front?.trim() && c.back?.trim())
    .map((c) => ({
      front: c.front.trim(),
      back: c.back.trim(),
    }));
}
