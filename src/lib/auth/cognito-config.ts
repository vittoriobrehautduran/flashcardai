// Central place for the AWS Cognito settings used by the login flow.
// Everything comes from environment variables so the same code works
// locally and on Amplify without changes.

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
}

// Auth is optional until the Cognito user pool exists. When these env vars
// are missing (e.g. plain local development), the app runs without login.
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.COGNITO_USER_POOL_ID &&
      process.env.COGNITO_CLIENT_ID &&
      process.env.COGNITO_CLIENT_SECRET &&
      process.env.COGNITO_DOMAIN
  );
}

// Read and normalize the Cognito settings. Only call this after
// isAuthConfigured() has confirmed the env vars exist.
export function getCognitoConfig(): CognitoConfig {
  const userPoolId = process.env.COGNITO_USER_POOL_ID!;
  const region = userPoolId.split("_")[0];

  // Accept the domain with or without the protocol prefix.
  const domain = process.env.COGNITO_DOMAIN!.replace(/^https?:\/\//, "");

  return {
    userPoolId,
    clientId: process.env.COGNITO_CLIENT_ID!,
    clientSecret: process.env.COGNITO_CLIENT_SECRET!,
    domain,
    region,
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  };
}

// Base URL used for Cognito redirect_uri / logout_uri.
// Localhost always uses the request origin (http://localhost:3000) so a
// deployed APP_URL in .env can't send the browser to https://localhost
// or to Amplify while you're developing locally.
export function getAppUrl(requestUrl: string): string {
  const origin = new URL(requestUrl).origin;
  const isLocal =
    origin.includes("localhost") || origin.includes("127.0.0.1");

  if (isLocal) return origin;

  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return origin;
}
