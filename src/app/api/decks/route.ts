import { NextResponse } from "next/server";
import { createDeck, listDecks, ModuleLimitError } from "@/lib/decks";
import {
  isCurrentUserAdmin,
  NON_ADMIN_MODULE_LIMIT,
  syncUserProfile,
} from "@/lib/auth/require-user";
import { requireApiUser } from "@/lib/api-route";
import { publicErrorMessage } from "@/lib/safe-log";

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const decks = await listDecks(auth.user.id);
  const isAdmin = await isCurrentUserAdmin(auth.user);

  return NextResponse.json({
    decks,
    meta: {
      isAdmin,
      moduleLimit: isAdmin ? null : NON_ADMIN_MODULE_LIMIT,
      moduleCount: decks.length,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  try {
    // First write path: make sure profile/admin row exists without doing this on every GET.
    await syncUserProfile(auth.user);

    const body = await request.json();
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const isAdmin = await isCurrentUserAdmin(auth.user);
    const deck = await createDeck(
      auth.user.id,
      name,
      body.description?.trim(),
      isAdmin
    );
    return NextResponse.json(deck, { status: 201 });
  } catch (error) {
    if (error instanceof ModuleLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "MODULE_LIMIT",
          limit: error.limit,
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: publicErrorMessage(error, "Failed to create module") },
      { status: 500 }
    );
  }
}
