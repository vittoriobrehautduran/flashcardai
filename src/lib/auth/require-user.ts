// Resolve the current user for API routes.
// Keep DB work rare: profile sync happens on login, not on every API call.

import { eq } from "drizzle-orm";
import { ensureAppSchema, getDb } from "@/db";
import { decks, userSettings } from "@/db/schema";
import { isAuthConfigured } from "@/lib/auth/cognito-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { AuthUser } from "@/lib/auth/session";

export const LOCAL_USER_ID = "local";
export const ADMIN_EMAIL = "vittoriobre@gmail.com";
export const NON_ADMIN_MODULE_LIMIT = 4;

// Remember admin checks for a few minutes so we don't hit Neon every time.
const ADMIN_CACHE_MS = 5 * 60 * 1000;
const adminCache = new Map<string, { value: boolean; expiresAt: number }>();
const profileSynced = new Set<string>();
let localDecksClaimed = false;

export class AuthRequiredError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "AuthRequiredError";
  }
}

// Auth only — no database. Safe to call on every API request.
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user) return user;

  if (!isAuthConfigured()) {
    return { id: LOCAL_USER_ID, email: null };
  }

  throw new AuthRequiredError();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

// Prefer the email on the login token; only ask the DB for rare manual admins.
export async function isCurrentUserAdmin(user: AuthUser): Promise<boolean> {
  if (isAdminEmail(user.email)) return true;

  const cached = adminCache.get(user.id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({ isAdmin: userSettings.isAdmin, email: userSettings.email })
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    const value =
      Boolean(row?.isAdmin) || isAdminEmail(row?.email ?? null);
    adminCache.set(user.id, { value, expiresAt: Date.now() + ADMIN_CACHE_MS });
    return value;
  } catch {
    // Table might not exist yet on a brand-new DB — treat as non-admin.
    return false;
  }
}

// Upsert profile + admin flag. Call on login (and maybe first settings save),
// not on every page load.
export async function syncUserProfile(user: AuthUser): Promise<void> {
  if (profileSynced.has(user.id)) return;

  await ensureAppSchema();
  const db = getDb();
  const now = new Date();
  const email = user.email?.trim().toLowerCase() || null;
  const shouldBeAdmin = isAdminEmail(email);

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

  adminCache.set(user.id, {
    value: shouldBeAdmin || Boolean(existing?.isAdmin),
    expiresAt: Date.now() + ADMIN_CACHE_MS,
  });

  // One-time recovery of old shared modules for the admin account.
  if (shouldBeAdmin && user.id !== LOCAL_USER_ID && !localDecksClaimed) {
    await db
      .update(decks)
      .set({ userId: user.id })
      .where(eq(decks.userId, LOCAL_USER_ID));
    localDecksClaimed = true;
  }

  profileSynced.add(user.id);
}
