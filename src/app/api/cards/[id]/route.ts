import { NextResponse } from "next/server";
import { deleteCard } from "@/lib/decks";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteCard(id);
  return NextResponse.json({ ok: true });
}
