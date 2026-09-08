import { NextResponse } from "next/server";
import { extractOrGenerateExercises, formatAiError } from "@/lib/math";
import { enforceRateLimit, requireApiUser } from "@/lib/api-route";

// Build practice exercises from already-imported PDF text (after user chooses Practice).
export async function POST(request: Request) {
  let language: "en" | "sv" = "sv";

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const limited = enforceRateLimit(auth.user.id, "mathExercises");
  if (limited) return limited;

  try {
    const body = await request.json();
    language = body.language === "en" ? "en" : "sv";
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const result = await extractOrGenerateExercises(text.slice(0, 20000), language);

    if (!result.exercises.length) {
      return NextResponse.json(
        { error: "No exercises could be extracted or generated from this PDF." },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const { message, status } = formatAiError(error, language);
    return NextResponse.json({ error: message }, { status });
  }
}
