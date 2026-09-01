import { NextResponse } from "next/server";
import { deleteDeck, getDeck, listCards, updateDeck } from "@/lib/decks";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deck = getDeck(id);

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const cards = listCards(id);
  return NextResponse.json({ deck, cards });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const deck = updateDeck(id, name, body.description?.trim());
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json(deck);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deck = getDeck(id);

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  deleteDeck(id);
  return NextResponse.json({ ok: true });
}
