import { NextResponse } from "next/server";
import { createCard, createCardsBatch } from "@/lib/decks";
import { requireApiUser, requireOwnedDeck } from "@/lib/api-route";
import { publicErrorMessage } from "@/lib/safe-log";

export async function POST(
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

    if (Array.isArray(body.cards)) {
      const created = await createCardsBatch(
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

    const card = await createCard(id, front, back, body.sourceSection?.trim());
    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, "Failed to save cards") },
      { status: 500 }
    );
  }
}
