// Signs the user out: clears our session cookies and ends the
// Cognito hosted UI session so the next login asks for credentials again.

import { NextRequest, NextResponse } from "next/server";
import { getAppUrl, getAuthCallbackUrl, getAuthLogoutUrl, getCognitoConfig, isAuthConfigured } from "@/lib/auth/cognito-config";
import { ID_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request.url);

  let redirectTarget = `${appUrl}/login`;
  if (isAuthConfigured()) {
    const { domain, clientId } = getCognitoConfig();
    // Cognito's logout endpoint clears its own session cookie, then sends
    // the user back to our login page (must be a registered sign-out URL).
    const logoutUrl = new URL(`https://${domain}/logout`);
    logoutUrl.searchParams.set("client_id", clientId);
    logoutUrl.searchParams.set("logout_uri", getAuthLogoutUrl(request.url));
    redirectTarget = logoutUrl.toString();
  }

  const response = NextResponse.redirect(redirectTarget);
  response.cookies.delete(ID_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}
