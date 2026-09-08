// Resolve the current user for API routes and sync admin status from email.

import { eq } from "drizzle-orm";
import { ensureAppSchema, getDb } from "@/db";
import { decks, userSettings } from "@/db/schema";
import { isAuthConfigured } from "@/lib/auth/cognito-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { AuthUser } from "@/lib/auth/session";

export const LOCAL_USER_ID = "local";
export const ADMIN_EMAIL = "vittoriobre@gmail.com";
export const NON_ADMIN_MODULE_LIMIT = 4;

export class AuthRequiredError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "AuthRequiredError";
  }
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user) {
    await syncUserProfile(user);
    return user;
  }

  if (!isAuthConfigured()) {
    const localUser: AuthUser = { id: LOCAL_USER_ID, email: null };
    await syncUserProfile(localUser);
    return localUser;
  }

  throw new AuthRequiredError();
}

// Upsert profile row and mark the known admin email in the database.
export async function syncUserProfile(user: AuthUser): Promise<void> {
  await ensureAppSchema();
  const db = getDb();
  const now = new Date();
  const email = user.email?.trim().toLowerCase() || null;
  const shouldBeAdmin = email === ADMIN_EMAIL;

  const [existing] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1);

  if (!existing) {
    await db.insert(userSettings).values({
      userId: user.id,
      email,
      isAdmin: shouldBeAdmin,
      geminiApiKeyEncrypted: null,
      updatedAt: now,
    });
  } else {
    const nextAdmin = shouldBeAdmin || existing.isAdmin;
    if (existing.email !== email || existing.isAdmin !== nextAdmin) {
      await db
        .update(userSettings)
        .set({
          email: email ?? existing.email,
          isAdmin: nextAdmin,
          updatedAt: now,
        })
        .where(eq(userSettings.userId, user.id));
    }
  }

  // One-time recovery: old shared modules were tagged "local" before ownership.
  // Move those to the admin account so existing study data is not stranded.
  if (shouldBeAdmin && user.id !== LOCAL_USER_ID) {
    await db
      .update(decks)
      .set({ userId: user.id })
      .where(eq(decks.userId, LOCAL_USER_ID));
  }
}

export async function isCurrentUserAdmin(userId: string): Promise<boolean> {
  await ensureAppSchema();
  const db = getDb();
  const [row] = await db
    .select({ isAdmin: userSettings.isAdmin, email: userSettings.email })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (!row) return false;
  if (row.isAdmin) return true;
  return (row.email ?? "").toLowerCase() === ADMIN_EMAIL;
}
