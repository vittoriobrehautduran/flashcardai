import { NextResponse } from "next/server";
import { formatOpenAiError, generateFlashcardsFromText } from "@/lib/openai";

export async function POST(request: Request) {
  let language: "en" | "sv" = "sv";

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
