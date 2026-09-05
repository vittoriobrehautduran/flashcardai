// Server-side helper to read the signed-in user inside API routes and
// server components. Kept separate from session.ts because next/headers
// cannot be imported from middleware.

import { cookies } from "next/headers";
import { isAuthConfigured } from "./cognito-config";
import { ID_TOKEN_COOKIE, verifyIdToken, type AuthUser } from "./session";

// Returns the signed-in user, or null when there is no valid session.
// When auth is not configured (local dev), there is no user to return.
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isAuthConfigured()) return null;

  const cookieStore = await cookies();
  const idToken = cookieStore.get(ID_TOKEN_COOKIE)?.value;
  if (!idToken) return null;

  return verifyIdToken(idToken);
}
