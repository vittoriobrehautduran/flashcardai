import { NextResponse } from "next/server";
import { deleteCardForUser } from "@/lib/decks";
import { requireApiUser } from "@/lib/api-route";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const deleted = await deleteCardForUser(id, auth.user.id);

  if (!deleted) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
