import { NextResponse } from "next/server";
import { createDeck, listDecks } from "@/lib/decks";

export async function GET() {
  const decks = listDecks();
  return NextResponse.json(decks);
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const deck = createDeck(name, body.description?.trim());
  return NextResponse.json(deck, { status: 201 });
}
