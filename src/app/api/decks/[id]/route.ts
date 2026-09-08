import { NextResponse } from "next/server";
import { deleteDeck, listCards, updateDeck } from "@/lib/decks";
import { requireApiUser, requireOwnedDeck } from "@/lib/api-route";
import { publicErrorMessage } from "@/lib/safe-log";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const owned = await requireOwnedDeck(id, auth.user.id);
  if ("response" in owned) return owned.response;

  const cards = await listCards(id);
  return NextResponse.json({ deck: owned.deck, cards });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const owned = await requireOwnedDeck(id, auth.user.id);
  if ("response" in owned) return owned.response;

  try {
    const body = await request.json();
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const deck = await updateDeck(id, auth.user.id, name, body.description?.trim());
    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    return NextResponse.json(deck);
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, "Failed to update module") },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const deleted = await deleteDeck(id, auth.user.id);

  if (!deleted) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
