// Starts the login flow: sends the user to the Cognito hosted UI.

import { NextRequest, NextResponse } from "next/server";
import { getAppUrl, getAuthCallbackUrl, getCognitoConfig, getCognitoConfigError, isAuthConfigured } from "@/lib/auth/cognito-config";
import { AUTH_STATE_COOKIE } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { domain, clientId, oauthScopes } = getCognitoConfig();
  const appUrl = getAppUrl(request.url);
  const callbackUrl = getAuthCallbackUrl(request.url);

  const configError = getCognitoConfigError();
  if (configError) {
    console.error(`Cognito login blocked: ${configError}`);
    const errorUrl = new URL("/login", request.url);
    errorUrl.searchParams.set("error", "config");
    return NextResponse.redirect(errorUrl);
  }

  // Where to send the user after login. Only allow same-site paths so the
  // "next" parameter can't be abused to redirect users to another site.
  const nextParam = request.nextUrl.searchParams.get("next") ?? "/";
  const nextPath = nextParam.startsWith("/") ? nextParam : "/";

  // Random state ties the callback to this login attempt (CSRF protection).
  const state = crypto.randomUUID();

  const authorizeUrl = new URL(`https://${domain}/oauth2/authorize`);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", oauthScopes);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(AUTH_STATE_COOKIE, JSON.stringify({ state, next: nextPath }), {
    httpOnly: true,
    secure: appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    // 10 minutes: plenty of time to log in, then the state is useless anyway.
    maxAge: 600,
  });
  return response;
}
