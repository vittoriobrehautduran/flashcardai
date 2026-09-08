import { NextResponse } from "next/server";
import { chunkText } from "@/lib/chunk-text";
import { extractTextFromPdf } from "@/lib/pdf";
import { enforceRateLimit, requireApiUser } from "@/lib/api-route";
import { publicErrorMessage } from "@/lib/safe-log";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const limited = enforceRateLimit(auth.user.id, "pdfExtract");
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
    const { text, pageCount, usedOcr, usedGeminiVision, ocrPages } = await extractTextFromPdf(buffer);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "No text found in PDF after text extraction and OCR." },
        { status: 400 }
      );
    }

    const chunks = chunkText(text);

    return NextResponse.json({
      text,
      charCount: text.length,
      chunks,
      pageCount,
      usedOcr,
      usedGeminiVision,
      ocrPages,
    });
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, "Failed to extract PDF") },
      { status: 500 }
    );
  }
}
