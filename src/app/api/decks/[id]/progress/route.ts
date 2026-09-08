import { NextResponse } from "next/server";
import { getDeckProgress } from "@/lib/progress";
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

  return NextResponse.json(await getDeckProgress(id));
}
