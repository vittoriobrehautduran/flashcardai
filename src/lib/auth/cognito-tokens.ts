// Calls to Cognito's OAuth2 token endpoint: exchanging the login code for
// tokens, and renewing tokens with a refresh token.

import { getCognitoConfig } from "./cognito-config";

export interface TokenSet {
  idToken: string;
  refreshToken: string | null;
  // Lifetime of the ID token in seconds (Cognito default is 3600)
  expiresIn: number;
}

// POST to the token endpoint with the app client credentials.
// Returns null when Cognito rejects the request (e.g. expired code).
async function requestTokens(params: Record<string, string>): Promise<TokenSet | null> {
  const { domain, clientId, clientSecret } = getCognitoConfig();

  // Cognito requires the client id + secret as HTTP Basic auth.
  // btoa (not Buffer) so this also runs in middleware's edge runtime.
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(`https://${domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({ client_id: clientId, ...params }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Cognito token request failed (${response.status}): ${errorBody}`);
    return null;
  }

  const data = await response.json();
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? 3600,
  };
}

// Exchange the one-time code from the hosted UI login for tokens.
export function exchangeCodeForTokens(code: string, redirectUri: string) {
  return requestTokens({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

// Get a fresh ID token using the long-lived refresh token.
export function refreshTokens(refreshToken: string) {
  return requestTokens({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}
