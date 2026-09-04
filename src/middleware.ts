// Blocks access to the app for users who are not logged in.
// Runs on every request except static assets (see the matcher below).

import { NextRequest, NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/auth/cognito-config";
import { refreshTokens } from "@/lib/auth/cognito-tokens";
import {
  ID_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  verifyIdToken,
} from "@/lib/auth/session";

// Pages and endpoints that must stay reachable without a session,
// otherwise nobody could ever log in.
const PUBLIC_PATH_PREFIXES = ["/login", "/api/auth/"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  // No Cognito env vars means auth is intentionally off (local development
  // before the user pool exists). Let everything through.
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Happy path: a valid ID token cookie means the user is signed in.
  const idToken = request.cookies.get(ID_TOKEN_COOKIE)?.value;
  if (idToken && (await verifyIdToken(idToken))) {
    return NextResponse.next();
  }

  // ID token missing or expired — try to renew it silently with the
  // refresh token so the user doesn't get bounced to the login screen.
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    const tokens = await refreshTokens(refreshToken);
    if (tokens && (await verifyIdToken(tokens.idToken))) {
      const response = NextResponse.next();
      response.cookies.set(ID_TOKEN_COOKIE, tokens.idToken, {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: tokens.expiresIn,
      });
      return response;
    }
  }

  // Not signed in. APIs get a clean 401 so fetch calls can handle it;
  // pages get sent to the login screen with a way back to where they were.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip Next.js internals and static files; everything else goes
  // through the auth check above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
