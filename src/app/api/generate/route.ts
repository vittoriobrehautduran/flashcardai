import { NextResponse } from "next/server";
import { formatOpenAiError, generateFlashcardsFromText } from "@/lib/openai";
import { enforceRateLimit, requireApiUser } from "@/lib/api-route";

export async function POST(request: Request) {
  let language: "en" | "sv" = "sv";

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const limited = enforceRateLimit(auth.user.id, "generate");
  if (limited) return limited;

  try {
    const body = await request.json();
    const text = body.text?.trim();
    const chunkIndex = body.chunkIndex ?? 0;
    const cardsPerChunk = body.cardsPerChunk ?? 8;
    const style = body.style ?? "qa";
    language = body.language === "en" ? "en" : "sv";

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const cards = await generateFlashcardsFromText(text, {
      cardsPerChunk,
      style,
      language,
    });

    return NextResponse.json({
      cards,
      chunkIndex,
    });
  } catch (error) {
    const { message, status } = formatOpenAiError(error, language);
    return NextResponse.json({ error: message }, { status });
  }
}
