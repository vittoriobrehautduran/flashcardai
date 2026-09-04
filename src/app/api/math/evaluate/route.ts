import { NextResponse } from "next/server";
import { gradeMathAnswer, gradeMathImage, formatAiError } from "@/lib/math";

export async function POST(request: Request) {
  let language: "en" | "sv" = "sv";

  try {
    const body = await request.json();
    language = body.language === "en" ? "en" : "sv";
    const exercise = body.exercise?.trim();
    const userAnswer = body.userAnswer?.trim();
    const userImageBase64 = body.userImageBase64;
    const imageMimeType = body.imageMimeType ?? "image/png";

    if (!exercise) {
      return NextResponse.json(
        { error: "exercise is required" },
        { status: 400 }
      );
    }

    if (!userAnswer && !userImageBase64) {
      return NextResponse.json(
        { error: "Provide either userAnswer (text) or userImageBase64 (photo)" },
        { status: 400 }
      );
    }

    let result;

    if (userImageBase64) {
      // Grade using Gemini Vision on the uploaded photo.
      // If text was also provided, include it as additional context.
      result = await gradeMathImage(
        userAnswer ? `${exercise}\n\nStudent also typed: ${userAnswer}` : exercise,
        userImageBase64,
        imageMimeType,
        language
      );
    } else {
      result = await gradeMathAnswer(exercise, userAnswer, language);
    }

    return NextResponse.json(result);
  } catch (error) {
    const { message, status } = formatAiError(error, language);
    return NextResponse.json({ error: message }, { status });
  }
}
