import { NextResponse } from "next/server";
import { getDeck } from "@/lib/decks";
import { getDeckProgress } from "@/lib/progress";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deck = getDeck(id);

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json(getDeckProgress(id));
}
