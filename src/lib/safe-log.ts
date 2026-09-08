// Production-safe logging — never dump secrets or full DB query params.

export function logServerError(context: string, error: unknown): void {
  const isProd = process.env.NODE_ENV === "production";
  const message = error instanceof Error ? error.message : String(error);

  // Strip common secret-ish fragments from messages before logging.
  const safeMessage = message
    .replace(/gemini_api_key_encrypted[^,\s]*/gi, "[redacted]")
    .replace(/AIza[0-9A-Za-z\-_]{10,}/g, "[redacted-key]")
    .replace(/npg_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/postgresql:\/\/[^\s]+/gi, "[redacted-db-url]")
    .replace(/params:\s*.+$/i, "params: [redacted]");

  if (isProd) {
    console.error(`[${context}]`, safeMessage);
    return;
  }

  console.error(`[${context}]`, error);
}

export function publicErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message;
  // Don't leak SQL / drizzle internals to the client in production.
  if (process.env.NODE_ENV === "production") {
    if (/failed query|neon|postgres|drizzle/i.test(msg)) return fallback;
  }
  return msg || fallback;
}
