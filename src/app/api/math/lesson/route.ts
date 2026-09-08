import { NextResponse } from "next/server";
import {
  generateMathLesson,
  helpWithLessonStep,
  formatAiError,
  type LessonStep,
} from "@/lib/math";
import { enforceRateLimit, requireApiUser } from "@/lib/api-route";

// Build a step-by-step lesson from imported PDF text (after user chooses Learn).
export async function POST(request: Request) {
  let language: "en" | "sv" = "sv";

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const limited = enforceRateLimit(auth.user.id, "mathLesson");
  if (limited) return limited;

  try {
    const body = await request.json();
    language = body.language === "en" ? "en" : "sv";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const action = body.action as string | undefined;

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // Optional follow-up help for one step (explain more / quiz me).
    if (action === "deeper" || action === "quiz") {
      const step = body.step as LessonStep | undefined;
      if (!step?.title || !step?.explanation) {
        return NextResponse.json({ error: "step is required" }, { status: 400 });
      }

      const helpLimited = enforceRateLimit(auth.user.id, "mathLessonHelp");
      if (helpLimited) return helpLimited;

      const help = await helpWithLessonStep({
        documentText: text.slice(0, 20000),
        step,
        action,
        language,
      });

      return NextResponse.json(help);
    }

    const lesson = await generateMathLesson(text.slice(0, 20000), language);

    if (!lesson.steps.length) {
      return NextResponse.json(
        { error: "Could not build a lesson from this PDF." },
        { status: 400 }
      );
    }

    return NextResponse.json(lesson);
  } catch (error) {
    const { message, status } = formatAiError(error, language);
    return NextResponse.json({ error: message }, { status });
  }
}
