import { NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/pdf";
import { enforceRateLimit, requireApiUser } from "@/lib/api-route";
import { publicErrorMessage } from "@/lib/safe-log";

// Import only — no Gemini yet. User chooses Learn or Practice next.
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const limited = enforceRateLimit(auth.user.id, "mathExtract");
  if (limited) return limited;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

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

    // Cap size before we send it to later AI steps.
    const trimmedText = text.slice(0, 20000);

    return NextResponse.json({
      text: trimmedText,
      charCount: trimmedText.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, "Failed to extract PDF") },
      { status: 500 }
    );
  }
}
