import { NextResponse } from "next/server";
import { createCard, createCardsBatch, getDeck } from "@/lib/decks";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deck = getDeck(id);

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const body = await request.json();

  if (Array.isArray(body.cards)) {
    const created = createCardsBatch(
      id,
      body.cards.map((c: { front: string; back: string; sourceSection?: string }) => ({
        front: c.front,
        back: c.back,
        sourceSection: c.sourceSection,
      }))
    );
    return NextResponse.json(created, { status: 201 });
  }

  const front = body.front?.trim();
  const back = body.back?.trim();

  if (!front || !back) {
    return NextResponse.json({ error: "Front and back are required" }, { status: 400 });
  }

  const card = createCard(id, front, back, body.sourceSection?.trim());
  return NextResponse.json(card, { status: 201 });
}
