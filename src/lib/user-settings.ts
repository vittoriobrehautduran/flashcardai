// Load and save per-user settings (Gemini API key) for the signed-in Cognito user.
// When auth is off locally, settings are stored under the fixed id "local".

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { isAuthConfigured } from "@/lib/auth/cognito-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { decryptSecret, encryptSecret, maskApiKey } from "@/lib/crypto/settings-secret";
import { syncUserProfile } from "@/lib/auth/require-user";

const LOCAL_USER_ID = "local";

// Cognito sub when logged in; "local" when auth is intentionally disabled.
export async function getSettingsUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (user) return user.id;

  if (!isAuthConfigured()) return LOCAL_USER_ID;

  throw new Error("Not signed in");
}

export async function getUserGeminiApiKey(): Promise<string | null> {
  const userId = await getSettingsUserId();
  const db = getDb();
  const rows = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const encrypted = rows[0]?.geminiApiKeyEncrypted;
  if (!encrypted) return null;

  try {
    return decryptSecret(encrypted);
  } catch {
    return null;
  }
}

export async function hasUserGeminiApiKey(): Promise<boolean> {
  const userId = await getSettingsUserId();
  const db = getDb();
  const rows = await db
    .select({ encrypted: userSettings.geminiApiKeyEncrypted })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return Boolean(rows[0]?.encrypted);
}

export async function getUserGeminiApiKeyStatus(): Promise<{
  hasKey: boolean;
  maskedKey: string | null;
}> {
  const key = await getUserGeminiApiKey();
  if (!key) return { hasKey: false, maskedKey: null };
  return { hasKey: true, maskedKey: maskApiKey(key) };
}

export async function saveUserGeminiApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("API key cannot be empty");
  }

  const user = await getCurrentUser();
  if (user) {
    await syncUserProfile(user);
  } else if (!isAuthConfigured()) {
    await syncUserProfile({ id: LOCAL_USER_ID, email: null });
  }

  const userId = await getSettingsUserId();
  const encrypted = encryptSecret(trimmed);
  const now = new Date();
  const db = getDb();

  await db
    .insert(userSettings)
    .values({
      userId,
      email: null,
      isAdmin: false,
      geminiApiKeyEncrypted: encrypted,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        geminiApiKeyEncrypted: encrypted,
        updatedAt: now,
      },
    });
}

export async function clearUserGeminiApiKey(): Promise<void> {
  const userId = await getSettingsUserId();
  const db = getDb();
  const now = new Date();

  await db
    .insert(userSettings)
    .values({
      userId,
      email: null,
      isAdmin: false,
      geminiApiKeyEncrypted: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        geminiApiKeyEncrypted: null,
        updatedAt: now,
      },
    });
}
