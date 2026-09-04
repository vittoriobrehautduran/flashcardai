import { extractPdfTextWithOcr } from "@/lib/pdf-ocr";

export async function extractTextFromPdf(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
  usedOcr: boolean;
  usedGeminiVision: boolean;
  ocrPages: number[];
}> {
  return extractPdfTextWithOcr(buffer);
}
