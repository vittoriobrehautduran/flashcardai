import { extractTextFromPdfDocument, isGeminiConfigured } from "@/lib/gemini";

const MIN_CHARS_PER_PAGE = 70;
// Gemini inline PDFs should stay well under the request size limit.
const MAX_GEMINI_PDF_BYTES = 12 * 1024 * 1024;

export async function extractPdfTextWithOcr(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
  usedOcr: boolean;
  usedGeminiVision: boolean;
  ocrPages: number[];
}> {
  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(buffer);
  const pageCount = parsed.numpages ?? 1;
  const textLayer = (parsed.text ?? "").trim();
  const isLikelyScanned = textLayer.length < pageCount * MIN_CHARS_PER_PAGE;

  if (!isLikelyScanned || !isGeminiConfigured() || buffer.length > MAX_GEMINI_PDF_BYTES) {
    return {
      text: textLayer,
      pageCount,
      usedOcr: false,
      usedGeminiVision: false,
      ocrPages: [],
    };
  }

  try {
    const visionText = await extractTextFromPdfDocument(buffer);
    const combined = visionText || textLayer;

    return {
      text: combined.trim(),
      pageCount,
      usedOcr: Boolean(visionText),
      usedGeminiVision: Boolean(visionText),
      ocrPages: visionText ? Array.from({ length: pageCount }, (_, i) => i + 1) : [],
    };
  } catch (error) {
    console.error("Gemini PDF vision failed, using text layer only:", error);
    return {
      text: textLayer,
      pageCount,
      usedOcr: false,
      usedGeminiVision: false,
      ocrPages: [],
    };
  }
}
