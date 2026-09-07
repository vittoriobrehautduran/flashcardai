import { NextResponse } from "next/server";
import {
  clearUserGeminiApiKey,
  getUserGeminiApiKeyStatus,
  saveUserGeminiApiKey,
} from "@/lib/user-settings";

export async function GET() {
  try {
    const status = await getUserGeminiApiKeyStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load settings";
    const status = message === "Not signed in" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
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
    const message = error instanceof Error ? error.message : "Failed to save settings";
    const status = message === "Not signed in" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  try {
    await clearUserGeminiApiKey();
    return NextResponse.json({ hasKey: false, maskedKey: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to clear settings";
    const status = message === "Not signed in" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
