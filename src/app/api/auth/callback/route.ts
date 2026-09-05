// Handles the redirect back from the Cognito hosted UI after login.
// Exchanges the one-time code for tokens and stores them in cookies.

import { NextRequest, NextResponse } from "next/server";
import { getAppUrl, getAuthCallbackUrl, isAuthConfigured } from "@/lib/auth/cognito-config";
import { exchangeCodeForTokens } from "@/lib/auth/cognito-tokens";
import {
  AUTH_STATE_COOKIE,
  ID_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  verifyIdToken,
} from "@/lib/auth/session";

// 30 days: matches the refresh token lifetime configured in Cognito.
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export async function GET(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const appUrl = getAppUrl(request.url);
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");

  // The state cookie was set when the login started. If it's missing or
  // doesn't match, this callback didn't come from our own login redirect.
  const stateCookie = request.cookies.get(AUTH_STATE_COOKIE)?.value;
  let expectedState: string | null = null;
  let nextPath = "/";
  if (stateCookie) {
    try {
      const parsed = JSON.parse(stateCookie);
      expectedState = parsed.state ?? null;
      if (typeof parsed.next === "string" && parsed.next.startsWith("/")) {
        nextPath = parsed.next;
      }
    } catch {
      // Malformed cookie — treat as missing state below.
    }
  }

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    console.error("Cognito callback rejected: missing code or state mismatch");
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const tokens = await exchangeCodeForTokens(code, getAuthCallbackUrl(request.url));
  if (!tokens) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  // Double-check the token really belongs to our pool before trusting it.
  const user = await verifyIdToken(tokens.idToken);
  if (!user) {
    console.error("Cognito callback rejected: ID token failed verification");
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const secure = appUrl.startsWith("https://");
  const response = NextResponse.redirect(`${appUrl}${nextPath}`);

  response.cookies.set(ID_TOKEN_COOKIE, tokens.idToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: tokens.expiresIn,
  });

  if (tokens.refreshToken) {
    response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
  }

  response.cookies.delete(AUTH_STATE_COOKIE);
  return response;
}
