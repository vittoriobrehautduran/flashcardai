import { NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/pdf";
import { extractOrGenerateExercises, formatAiError } from "@/lib/math";

export async function POST(request: Request) {
  let language: "en" | "sv" = "sv";

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    language = (formData.get("language") as string) === "en" ? "en" : "sv";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text } = await extractTextFromPdf(buffer);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "No text found in the PDF." },
        { status: 400 }
      );
    }

    // Limit text to ~20k chars to stay within context limits and reduce token usage.
    const trimmedText = text.slice(0, 20000);

    const result = await extractOrGenerateExercises(trimmedText, language);

    return NextResponse.json(result);
  } catch (error) {
    const { message, status } = formatAiError(error, language);
    return NextResponse.json({ error: message }, { status });
  }
}
