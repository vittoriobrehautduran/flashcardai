// Encrypt / decrypt user secrets at rest (Gemini API keys in Postgres).
// Uses AES-256-GCM with a key derived from SETTINGS_SECRET (or Neon URL as fallback).

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function getEncryptionKey(): Buffer {
  const secret =
    process.env.SETTINGS_SECRET?.trim() ||
    process.env.NEON_CONNECTION_STRING?.trim() ||
    process.env.COGNITO_CLIENT_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "SETTINGS_SECRET is missing. Add it to .env.local (or Amplify env vars) to store API keys safely."
    );
  }

  // 32 bytes for AES-256
  return createHash("sha256").update(secret).digest();
}

// Returns "ivBase64:tagBase64:ciphertextBase64"
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted secret format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

// Show only the last few characters in the UI.
export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}
