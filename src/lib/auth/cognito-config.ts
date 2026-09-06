// Central place for the AWS Cognito settings used by the login flow.
// Everything comes from environment variables so the same code works
// locally and on Amplify without changes.

import type { NextRequest } from "next/server";

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  clientSecret: string;
  // Hosted UI domain, e.g. "flashcardai.auth.eu-north-1.amazoncognito.com"
  domain: string;
  // AWS region, derived from the user pool id ("eu-north-1_AbC123" -> "eu-north-1")
  region: string;
  // Token issuer URL, used to verify that JWTs really come from our pool
  issuer: string;
  // OAuth scopes sent to the hosted UI authorize endpoint
  oauthScopes: string;
}

// Trim whitespace — Amplify env vars often pick up trailing spaces/newlines
// when pasted in the console, which breaks client_id and redirect matching.
function trimEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

// Normalize the Cognito hosted UI domain from common copy-paste mistakes.
function normalizeCognitoDomain(raw: string): string {
  let domain = raw.trim();

  // Strip protocol if someone pasted a full URL.
  domain = domain.replace(/^https?:\/\//, "");
  // Drop anything after the hostname (e.g. "/oauth2/authorize").
  domain = domain.split("/")[0];
  // Remove trailing dot some consoles add.
  domain = domain.replace(/\.$/, "");

  return domain;
}

function isLocalHost(host: string): boolean {
  return host.includes("localhost") || host.includes("127.0.0.1");
}

// Auth is optional until the Cognito user pool exists. When these env vars
// are missing (e.g. plain local development), the app runs without login.
export function isAuthConfigured(): boolean {
  return Boolean(
    trimEnv(process.env.COGNITO_USER_POOL_ID) &&
      trimEnv(process.env.COGNITO_CLIENT_ID) &&
      trimEnv(process.env.COGNITO_CLIENT_SECRET) &&
      trimEnv(process.env.COGNITO_DOMAIN)
  );
}

// Read and normalize the Cognito settings. Only call this after
// isAuthConfigured() has confirmed the env vars exist.
export function getCognitoConfig(): CognitoConfig {
  const userPoolId = trimEnv(process.env.COGNITO_USER_POOL_ID);
  const region = userPoolId.split("_")[0];
  const domain = normalizeCognitoDomain(trimEnv(process.env.COGNITO_DOMAIN));

  // Default scopes; override if your app client only has openid enabled.
  const oauthScopes =
    trimEnv(process.env.COGNITO_OAUTH_SCOPES) || "openid email profile";

  return {
    userPoolId,
    clientId: trimEnv(process.env.COGNITO_CLIENT_ID),
    clientSecret: trimEnv(process.env.COGNITO_CLIENT_SECRET),
    domain,
    region,
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
    oauthScopes,
  };
}

// Quick sanity check before sending the user to Cognito's hosted UI.
// Returns a short error message when something looks wrong, or null when OK.
export function getCognitoConfigError(): string | null {
  if (!isAuthConfigured()) return "Auth is not configured";

  const { domain, clientId, userPoolId } = getCognitoConfig();

  if (!userPoolId.includes("_")) {
    return "COGNITO_USER_POOL_ID looks invalid (expected format: region_poolId)";
  }

  if (clientId.length < 10) {
    return "COGNITO_CLIENT_ID looks too short";
  }

  // Hosted UI domain must look like "prefix.auth.region.amazoncognito.com".
  if (!/^[a-z0-9-]+\.auth\.[a-z0-9-]+\.amazoncognito\.com$/i.test(domain)) {
    return "COGNITO_DOMAIN must be your hosted UI domain (e.g. myapp.auth.eu-north-1.amazoncognito.com), not the cognito-idp issuer URL";
  }

  return null;
}

// Public site origin for Cognito redirect_uri / logout_uri.
// Local: always the browser host (http://localhost:3000).
// Amplify: prefer APP_URL — request.url behind Amplify SSR is often an
// internal host, which causes Cognito redirect_mismatch.
export function getAppUrl(request: NextRequest | string): string {
  const configured = trimEnv(process.env.APP_URL).replace(/\/$/, "");

  if (typeof request === "string") {
    const origin = new URL(request).origin;
    if (isLocalHost(origin)) return origin;
    return configured || origin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = request.headers.get("host")?.split(",")[0]?.trim();
  const host = forwardedHost || hostHeader || request.nextUrl.host;

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const proto = forwardedProto || (isLocalHost(host) ? "http" : "https");
  const derived = `${proto}://${host}`.replace(/\/$/, "");

  if (isLocalHost(host)) return derived;

  // Stable Amplify URL from env beats whatever the SSR runtime thinks the host is.
  if (configured) return configured;

  return derived;
}

// The callback URL Cognito must have in "Allowed callback URLs".
export function getAuthCallbackUrl(request: NextRequest | string): string {
  return `${getAppUrl(request)}/api/auth/callback`;
}

// The sign-out URL Cognito must have in "Allowed sign-out URLs".
export function getAuthLogoutUrl(request: NextRequest | string): string {
  return `${getAppUrl(request)}/login`;
}
