import { createCanvas, DOMMatrix, ImageData } from "canvas";
import Tesseract from "tesseract.js";
import { extractTextFromPageImage, isGeminiConfigured } from "@/lib/gemini";

// pdfjs expects browser globals when rendering in Node.
if (!globalThis.DOMMatrix) {
  globalThis.DOMMatrix = DOMMatrix as typeof globalThis.DOMMatrix;
}
if (!globalThis.ImageData) {
  globalThis.ImageData = ImageData as typeof globalThis.ImageData;
}

const MAX_OCR_PAGES = 40;
const MAX_GEMINI_VISION_PAGES = 12;
const GEMINI_VISION_DELAY_MS = 12000;
const MIN_CHARS_PER_PAGE = 70;

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

async function loadPdfJs(): Promise<PdfJsModule> {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

async function openPdf(buffer: Buffer) {
  const pdfjs = await loadPdfJs();
  return await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  }).promise;
}

async function ocrPageWithTesseract(imageBuffer: Buffer): Promise<string> {
  const result = await Tesseract.recognize(imageBuffer, "swe+eng", {
    logger: () => undefined,
  });
  return (result.data.text ?? "").trim();
}

async function ocrPageImage(
  imageBuffer: Buffer,
  pageNum: number,
  allowGemini: boolean
): Promise<{ text: string; usedGemini: boolean }> {
  if (allowGemini && isGeminiConfigured()) {
    try {
      const text = await extractTextFromPageImage(imageBuffer, pageNum);
      if (text) {
        return { text, usedGemini: true };
      }
    } catch {
      // Fall back to local OCR if Gemini fails (rate limit, etc.)
    }
  }

  const text = await ocrPageWithTesseract(imageBuffer);
  return { text, usedGemini: false };
}

async function renderPageToPng(pdfDoc: Awaited<ReturnType<typeof openPdf>>, pageNum: number): Promise<Buffer> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  return canvas.toBuffer("image/png");
}

async function pageHasImages(pdfjs: PdfJsModule, pageNum: number, pdfDoc: Awaited<ReturnType<typeof openPdf>>): Promise<boolean> {
  const page = await pdfDoc.getPage(pageNum);
  const ops = await page.getOperatorList();
  return ops.fnArray.some(
    (fn) => fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintXObject
  );
}

export interface OcrPageResult {
  page: number;
  text: string;
  usedGemini: boolean;
}

export async function ocrPdfPages(buffer: Buffer, pageNumbers: number[]): Promise<OcrPageResult[]> {
  const pdfDoc = await openPdf(buffer);
  const results: OcrPageResult[] = [];

  let geminiPagesUsed = 0;

  for (const pageNum of pageNumbers) {
    if (pageNum < 1 || pageNum > pdfDoc.numPages) continue;

    try {
      const png = await renderPageToPng(pdfDoc, pageNum);
      const allowGemini = geminiPagesUsed < MAX_GEMINI_VISION_PAGES;
      const { text, usedGemini } = await ocrPageImage(png, pageNum, allowGemini);
      if (usedGemini) {
        geminiPagesUsed += 1;
      }
      if (text) {
        results.push({ page: pageNum, text, usedGemini });
      }

      // Stay within Gemini free-tier RPM on multi-page scans
      if (usedGemini && pageNumbers.length > 1) {
        await new Promise((r) => setTimeout(r, GEMINI_VISION_DELAY_MS));
      }
    } catch (error) {
      console.error(`PDF page ${pageNum} OCR failed:`, error);
    }
  }

  return results;
}

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

  const pagesToScan = new Set<number>();
  const isLikelyScanned = textLayer.length < pageCount * MIN_CHARS_PER_PAGE;

  if (isLikelyScanned) {
    for (let i = 1; i <= Math.min(pageCount, MAX_OCR_PAGES); i++) {
      pagesToScan.add(i);
    }
  } else if (pageCount <= MAX_OCR_PAGES) {
    const pdfjs = await loadPdfJs();
    const pdfDoc = await openPdf(buffer);

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      if (await pageHasImages(pdfjs, i, pdfDoc)) {
        pagesToScan.add(i);
      }
    }
  }

  if (pagesToScan.size === 0) {
    return {
      text: textLayer,
      pageCount,
      usedOcr: false,
      usedGeminiVision: false,
      ocrPages: [],
    };
  }

  const ocrResults = await ocrPdfPages(buffer, Array.from(pagesToScan).sort((a, b) => a - b));
  const ocrSections = ocrResults.map((r) => `[Page ${r.page}]\n${r.text}`);
  const ocrText = ocrSections.join("\n\n");
  const usedGeminiVision = ocrResults.some((r) => r.usedGemini);

  let combined = textLayer;
  if (ocrText) {
    if (isLikelyScanned) {
      combined = ocrText;
    } else {
      combined = `${textLayer}\n\n--- Text from images / scanned areas ---\n${ocrText}`;
    }
  }

  return {
    text: combined.trim(),
    pageCount,
    usedOcr: ocrResults.length > 0,
    usedGeminiVision,
    ocrPages: ocrResults.map((r) => r.page),
  };
}
