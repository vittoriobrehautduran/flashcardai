import { NextResponse } from "next/server";
import {
  evaluateWrittenQuizAnswer,
  formatOpenAiError,
} from "@/lib/openai-quiz";
import { enforceRateLimit, requireApiUser } from "@/lib/api-route";

export async function POST(request: Request) {
  let language: "en" | "sv" = "sv";

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const limited = enforceRateLimit(auth.user.id, "quizEvaluate");
  if (limited) return limited;

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
