// Neon Postgres client for local + Amplify.
// Uses the serverless HTTP driver so it works in Node and on Amplify SSR.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function getConnectionString() {
  // Neon CLI writes DATABASE_URL; Amplify historically used NEON_CONNECTION_STRING.
  const url =
    process.env.NEON_CONNECTION_STRING?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Database URL is missing. Add NEON_CONNECTION_STRING or DATABASE_URL to .env.local / Amplify."
    );
  }
  return url;
}

let db: ReturnType<typeof createDatabase> | null = null;
let userSettingsReady: Promise<void> | null = null;

function createDatabase() {
  const sql = neon(getConnectionString());
  return drizzle(sql, { schema });
}

export function getDb() {
  if (!db) {
    db = createDatabase();
  }
  return db;
}

// Creates the settings table if an older Neon DB was set up before this feature.
export async function ensureUserSettingsTable(): Promise<void> {
  if (!userSettingsReady) {
    userSettingsReady = (async () => {
      const sql = neon(getConnectionString());
      await sql`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id text PRIMARY KEY,
          gemini_api_key_encrypted text,
          updated_at timestamptz NOT NULL
        )
      `;
    })().catch((error) => {
      userSettingsReady = null;
      throw error;
    });
  }

  await userSettingsReady;
}
