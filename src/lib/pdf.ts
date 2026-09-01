import pdf from "pdf-parse";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const result = await pdf(buffer);
  return result.text ?? "";
}
