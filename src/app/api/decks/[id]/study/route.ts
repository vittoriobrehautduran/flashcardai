import { NextResponse } from "next/server";
import { getDueCards, submitReview } from "@/lib/decks";
import { Rating, type Grade } from "@/lib/fsrs";
import { updateStudySession, completeStudySession } from "@/lib/progress";
import { requireApiUser, requireOwnedDeck } from "@/lib/api-route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const owned = await requireOwnedDeck(id, auth.user.id);
  if ("response" in owned) return owned.response;

  const cards = await getDueCards(id);
  return NextResponse.json({ cards });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id: deckId } = await params;
  const owned = await requireOwnedDeck(deckId, auth.user.id);
  if ("response" in owned) return owned.response;

  const body = await request.json();
  const cardId = body.cardId;
  const rating = body.rating as Grade;
  const sessionId = body.sessionId as string | undefined;
  const currentIndex = body.currentIndex as number | undefined;
  const reviewedCount = body.reviewedCount as number | undefined;
  const sessionComplete = body.sessionComplete as boolean | undefined;

  if (!cardId || rating === undefined) {
    return NextResponse.json({ error: "cardId and rating are required" }, { status: 400 });
  }

  const validRatings: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];
  if (!validRatings.includes(rating)) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }

  await submitReview(cardId, rating);

  if (sessionId && currentIndex !== undefined && reviewedCount !== undefined) {
    if (sessionComplete) {
      await completeStudySession(sessionId);
    } else {
      await updateStudySession(sessionId, currentIndex, reviewedCount);
    }
  }

  const remaining = await getDueCards(deckId);

  return NextResponse.json({ ok: true, remainingCount: remaining.length });
}
