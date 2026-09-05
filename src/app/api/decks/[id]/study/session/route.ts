import { NextResponse } from "next/server";
import { getDueCards, getDeck } from "@/lib/decks";
import {
  getActiveStudySession,
  startStudySession,
  updateStudySession,
  abandonStudySession,
  getCardsByIds,
} from "@/lib/progress";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deck = await getDeck(id);

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const active = await getActiveStudySession(id);
  if (active) {
    const cards = await getCardsByIds(active.cardIds);
    return NextResponse.json({
      cards,
      session: {
        id: active.id,
        currentIndex: active.currentIndex,
        reviewedCount: active.reviewedCount,
      },
    });
  }

  const dueCards = await getDueCards(id);
  return NextResponse.json({ cards: dueCards, session: null });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deckId } = await params;
  const deck = await getDeck(deckId);

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const body = await request.json();
  const cardIds = body.cardIds as string[] | undefined;

  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return NextResponse.json({ error: "cardIds are required" }, { status: 400 });
  }

  const session = await startStudySession(deckId, cardIds);
  const cards = await getCardsByIds(session.cardIds);

  return NextResponse.json({
    session: {
      id: session.id,
      currentIndex: session.currentIndex,
      reviewedCount: session.reviewedCount,
    },
    cards,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deckId } = await params;
  const deck = await getDeck(deckId);

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const body = await request.json();
  const sessionId = body.sessionId as string | undefined;
  const currentIndex = body.currentIndex as number | undefined;
  const reviewedCount = body.reviewedCount as number | undefined;

  if (!sessionId || currentIndex === undefined || reviewedCount === undefined) {
    return NextResponse.json(
      { error: "sessionId, currentIndex, reviewedCount required" },
      { status: 400 }
    );
  }

  await updateStudySession(sessionId, currentIndex, reviewedCount);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deckId } = await params;
  const deck = await getDeck(deckId);

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = body.sessionId as string | undefined;

  if (sessionId) {
    await abandonStudySession(sessionId);
  } else {
    const active = await getActiveStudySession(deckId);
    if (active) await abandonStudySession(active.id);
  }

  return NextResponse.json({ ok: true });
}
