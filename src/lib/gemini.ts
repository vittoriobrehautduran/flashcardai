import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

// 3.5 Flash Lite is the current free-tier default for new API keys.
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";

const MAX_RETRIES = 3;
const BASE_RETRY_MS = 8000;

export interface GenerateApiError {
  message: string;
  status: number;
}

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to your .env.local file.");
  }
  return apiKey;
}

function getModel(json = false): GenerativeModel {
  const genAI = new GoogleGenerativeAI(getApiKey());
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: json ? { responseMimeType: "application/json" } : undefined,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  );
}

function isDailyQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("per day") ||
    lower.includes("per_day") ||
    lower.includes("daily") ||
    lower.includes("rpd") ||
    lower.includes("generate_requests_per_day")
  );
}

export function formatAiError(error: unknown, language: "en" | "sv" = "en"): GenerateApiError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("api key") || lower.includes("api_key")) {
    return {
      status: 401,
      message:
        language === "sv"
          ? "Ogiltig GEMINI_API_KEY. Kontrollera nyckeln i .env.local."
          : "Invalid GEMINI_API_KEY. Check your key in .env.local.",
    };
  }

  if (isRateLimitError(error)) {
    const daily = isDailyQuotaError(message);
    return {
      status: 429,
      message:
        language === "sv"
          ? daily
            ? "Daglig Gemini-gräns nådd (gratisnivå). Vänta till imorgon eller aktivera fakturering i Google AI Studio."
            : "För många Gemini-anrop på en gång (gratisnivå ~10/min). Vänta 1–2 minuter och försök igen. Stora PDF:er med bilder räknas som många anrop."
          : daily
            ? "Daily Gemini limit reached (free tier). Wait until tomorrow or enable billing in Google AI Studio."
            : "Too many Gemini requests in a short time (free tier ~10/min). Wait 1–2 minutes and try again. Large PDFs with images count as many requests.",
    };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return {
    status: 500,
    message: language === "sv" ? "Generering misslyckades" : "Generation failed",
  };
}

export async function callWithRetryExported<T>(fn: () => Promise<T>): Promise<T> {
  return callWithRetry(fn);
}

async function callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === MAX_RETRIES - 1) {
        throw error;
      }
      await sleep(BASE_RETRY_MS * (attempt + 1));
    }
  }

  throw lastError;
}

export async function generateJson<T>(
  systemInstruction: string,
  userPrompt: string
): Promise<T> {
  return callWithRetry(async () => {
    const model = getModel(true);
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction,
    });

    const raw = result.response.text();
    if (!raw) {
      throw new Error("Empty response from Gemini");
    }

    return JSON.parse(raw) as T;
  });
}

export async function extractTextFromPageImage(
  imageBuffer: Buffer,
  pageNum: number
): Promise<string> {
  return callWithRetry(async () => {
    const model = getModel(false);
    const base64 = imageBuffer.toString("base64");

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/png",
          data: base64,
        },
      },
      {
        text: `This is page ${pageNum} of a study document PDF. Extract ALL readable text from this page, including:
- body text
- headings and captions
- text inside diagrams, charts, and images
- labels on figures

Return plain text only. Preserve logical reading order. If there is no readable text, return an empty string.`,
      },
    ]);

    return (result.response.text() ?? "").trim();
  });
}

// Send the PDF itself to Gemini Vision. Works on Amplify without pdf.js workers or native canvas.
export async function extractTextFromPdfDocument(pdfBuffer: Buffer): Promise<string> {
  return callWithRetry(async () => {
    const model = getModel(false);
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBuffer.toString("base64"),
        },
      },
      {
        text: `Extract ALL readable text from this PDF, including:
- body text
- headings and captions
- text inside diagrams, charts, and images
- labels on figures
- math notation and exercise statements

Return plain text only. Preserve logical reading order. If there is no readable text, return an empty string.`,
      },
    ]);

    return (result.response.text() ?? "").trim();
  });
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}
