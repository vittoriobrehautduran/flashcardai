import { NextResponse } from "next/server";
import { chunkText } from "@/lib/chunk-text";
import { extractTextFromPdf } from "@/lib/pdf";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromPdf(buffer);

  if (!text.trim()) {
    return NextResponse.json(
      { error: "No text found in PDF. Scanned documents need OCR (not supported yet)." },
      { status: 400 }
    );
  }

  const chunks = chunkText(text);

  return NextResponse.json({
    text,
    charCount: text.length,
    chunks,
  });
}
