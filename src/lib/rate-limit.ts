// Simple in-memory rate limiter for expensive / sensitive API routes.
// Good enough on Amplify to slow abuse; not a global distributed limiter.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec?: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  entry.count += 1;
  return { ok: true };
}

export function rateLimitResponse(retryAfterSec: number) {
  return {
    error: `Too many requests. Try again in ${retryAfterSec}s.`,
    retryAfterSec,
  };
}

// Presets used by routes
export const RATE_LIMITS = {
  settingsWrite: { limit: 20, windowMs: 60 * 60 * 1000 }, // 20/hour
  generate: { limit: 30, windowMs: 60 * 60 * 1000 }, // 30/hour
  pdfExtract: { limit: 20, windowMs: 60 * 60 * 1000 }, // 20/hour
  mathExtract: { limit: 20, windowMs: 60 * 60 * 1000 },
  mathExercises: { limit: 20, windowMs: 60 * 60 * 1000 },
  mathLesson: { limit: 20, windowMs: 60 * 60 * 1000 },
  mathLessonHelp: { limit: 60, windowMs: 60 * 60 * 1000 },
  mathEvaluate: { limit: 60, windowMs: 60 * 60 * 1000 },
  quizGenerate: { limit: 30, windowMs: 60 * 60 * 1000 },
  quizEvaluate: { limit: 120, windowMs: 60 * 60 * 1000 },
} as const;
