import { NextResponse } from "next/server";
import {
  evaluateWrittenQuizAnswer,
  formatOpenAiError,
} from "@/lib/openai-quiz";

export async function POST(request: Request) {
  let language: "en" | "sv" = "sv";

  try {
    const body = await request.json();
    language = body.language === "en" ? "en" : "sv";
    const question = body.question?.trim();
    const correctAnswer = body.correctAnswer?.trim();
    const userAnswer = body.userAnswer?.trim();

    if (!question || !correctAnswer || !userAnswer) {
      return NextResponse.json(
        { error: "question, correctAnswer, and userAnswer are required" },
        { status: 400 }
      );
    }

    const result = await evaluateWrittenQuizAnswer(
      question,
      correctAnswer,
      userAnswer,
      language
    );

    return NextResponse.json(result);
  } catch (error) {
    const { message, status } = formatOpenAiError(error, language);
    return NextResponse.json({ error: message }, { status });
  }
}
