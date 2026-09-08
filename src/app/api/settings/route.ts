import { NextResponse } from "next/server";
import {
  clearUserGeminiApiKey,
  getUserGeminiApiKeyStatus,
  saveUserGeminiApiKey,
} from "@/lib/user-settings";
import { enforceRateLimit, requireApiUser } from "@/lib/api-route";
import { publicErrorMessage } from "@/lib/safe-log";

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  try {
    const status = await getUserGeminiApiKeyStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message = publicErrorMessage(error, "Failed to load settings");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const limited = enforceRateLimit(auth.user.id, "settingsWrite");
  if (limited) return limited;

  try {
    const body = await request.json();
    const apiKey = typeof body.geminiApiKey === "string" ? body.geminiApiKey.trim() : "";

    if (!apiKey) {
      return NextResponse.json({ error: "geminiApiKey is required" }, { status: 400 });
    }

    await saveUserGeminiApiKey(apiKey);
    const status = await getUserGeminiApiKeyStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message = publicErrorMessage(error, "Failed to save settings");
    const status = message === "Not signed in" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const limited = enforceRateLimit(auth.user.id, "settingsWrite");
  if (limited) return limited;

  try {
    await clearUserGeminiApiKey();
    return NextResponse.json({ hasKey: false, maskedKey: null });
  } catch (error) {
    const message = publicErrorMessage(error, "Failed to clear settings");
    const status = message === "Not signed in" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
