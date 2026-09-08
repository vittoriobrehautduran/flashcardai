// Shared auth + rate-limit helpers for API routes.

import { NextResponse } from "next/server";
import { AuthRequiredError, requireUser } from "@/lib/auth/require-user";
import type { AuthUser } from "@/lib/auth/session";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { getDeckForUser } from "@/lib/decks";
import type { Deck } from "@/db/schema";
import { publicErrorMessage } from "@/lib/safe-log";

export async function requireApiUser(): Promise<
  { user: AuthUser } | { response: NextResponse }
> {
  try {
    const user = await requireUser();
    return { user };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return {
        response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
      };
    }
    const message = publicErrorMessage(error, "Authentication failed");
    return {
      response: NextResponse.json({ error: message }, { status: 500 }),
    };
  }
}

export function enforceRateLimit(
  userId: string,
  kind: keyof typeof RATE_LIMITS
): NextResponse | null {
  const cfg = RATE_LIMITS[kind];
  const result = checkRateLimit(`${kind}:${userId}`, cfg.limit, cfg.windowMs);
  if (!result.ok) {
    return NextResponse.json(rateLimitResponse(result.retryAfterSec!), {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    });
  }
  return null;
}

export async function requireOwnedDeck(
  deckId: string,
  userId: string
): Promise<{ deck: Deck } | { response: NextResponse }> {
  const deck = await getDeckForUser(deckId, userId);
  if (!deck) {
    return {
      response: NextResponse.json({ error: "Deck not found" }, { status: 404 }),
    };
  }
  return { deck };
}
