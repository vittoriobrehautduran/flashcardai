// JWT verification and cookie names for the Cognito session.
// Uses "jose" instead of an AWS SDK so it also runs in Next.js middleware
// (edge runtime), where Node-only crypto modules are not available.

import { createRemoteJWKSet, jwtVerify } from "jose";
import { getCognitoConfig } from "./cognito-config";

export const ID_TOKEN_COOKIE = "fc_id_token";
export const REFRESH_TOKEN_COOKIE = "fc_refresh_token";
export const AUTH_STATE_COOKIE = "fc_auth_state";

export interface AuthUser {
  // Cognito's stable unique id for the user ("sub" claim)
  id: string;
  email: string | null;
}

// Cache the JWKS fetcher between requests; jose caches the keys internally
// so we don't hit the Cognito endpoint on every verification.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const { issuer } = getCognitoConfig();
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }
  return jwks;
}

// Check that the ID token is signed by our user pool and not expired.
// Returns the user on success, or null for any invalid/expired token.
export async function verifyIdToken(token: string): Promise<AuthUser | null> {
  const { issuer, clientId } = getCognitoConfig();

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer,
      audience: clientId,
    });

    if (typeof payload.sub !== "string") return null;

    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch {
    // Bad signature, wrong issuer/audience, or expired — treat all the same.
    return null;
  }
}
