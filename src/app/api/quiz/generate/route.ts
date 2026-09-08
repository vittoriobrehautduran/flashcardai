import { NextResponse } from "next/server";
import {
  formatOpenAiError,
  generateQuizQuestionsWithAi,
} from "@/lib/openai-quiz";
import { enforceRateLimit, requireApiUser } from "@/lib/api-route";

export async function POST(request: Request) {
  let language: "en" | "sv" = "sv";

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const limited = enforceRateLimit(auth.user.id, "quizGenerate");
  if (limited) return limited;

  try {
    const body = await request.json();
    language = body.language === "en" ? "en" : "sv";
    const cards = body.cards as Array<{ id: string; front: string; back: string }> | undefined;
    const questionCount = body.questionCount as number | undefined;

    if (!cards || cards.length === 0) {
      return NextResponse.json({ error: "cards are required" }, { status: 400 });
    }

    const count = questionCount ?? Math.min(5, cards.length);
    const questions = await generateQuizQuestionsWithAi(cards, count, language);

    return NextResponse.json({ questions });
  } catch (error) {
    const { message, status } = formatOpenAiError(error, language);
    return NextResponse.json({ error: message }, { status });
  }
}
