// Split extracted PDF text into chunks for API calls.
// Each chunk stays under maxChars so we stay within context limits.

const DEFAULT_MAX_CHARS = 6000;

export interface TextChunk {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
}

export function chunkText(text: string, maxChars = DEFAULT_MAX_CHARS): TextChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  if (normalized.length <= maxChars) {
    return [{ index: 0, text: normalized, charStart: 0, charEnd: normalized.length }];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);

    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const breakAt = findBreakPoint(slice);
      end = start + breakAt;
    }

    const chunkText = normalized.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({
        index,
        text: chunkText,
        charStart: start,
        charEnd: end,
      });
      index += 1;
    }

    start = end;
  }

  return chunks;
}

function findBreakPoint(slice: string): number {
  const minBreak = Math.floor(slice.length * 0.6);

  const paragraphBreak = slice.lastIndexOf("\n\n", slice.length - 1);
  if (paragraphBreak >= minBreak) return paragraphBreak;

  const lineBreak = slice.lastIndexOf("\n", slice.length - 1);
  if (lineBreak >= minBreak) return lineBreak;

  const sentenceBreak = slice.lastIndexOf(". ", slice.length - 1);
  if (sentenceBreak >= minBreak) return sentenceBreak + 1;

  const spaceBreak = slice.lastIndexOf(" ", slice.length - 1);
  if (spaceBreak >= minBreak) return spaceBreak;

  return slice.length;
}
