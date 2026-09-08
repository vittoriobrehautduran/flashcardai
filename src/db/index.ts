// Neon Postgres client for local + Amplify.
// Uses the serverless HTTP driver so it works in Node and on Amplify SSR.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { logServerError } from "@/lib/safe-log";

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
let schemaReady: Promise<void> | null = null;

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

// Idempotent migrations for older Neon databases.
export async function ensureAppSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = neon(getConnectionString());

      await sql`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id text PRIMARY KEY,
          email text,
          is_admin boolean NOT NULL DEFAULT false,
          gemini_api_key_encrypted text,
          updated_at timestamptz NOT NULL
        )
      `;

      // Older installs may lack these columns
      await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS email text`;
      await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false`;

      await sql`ALTER TABLE decks ADD COLUMN IF NOT EXISTS user_id text`;
      await sql`UPDATE decks SET user_id = 'local' WHERE user_id IS NULL`;
      await sql`ALTER TABLE decks ALTER COLUMN user_id SET DEFAULT 'local'`;
      await sql`ALTER TABLE decks ALTER COLUMN user_id SET NOT NULL`;

      // Seed known admin by email whenever that user exists in settings
      await sql`
        UPDATE user_settings
        SET is_admin = true
        WHERE lower(email) = 'vittoriobre@gmail.com'
      `;
    })().catch((error) => {
      schemaReady = null;
      logServerError("ensureAppSchema", error);
      throw error;
    });
  }

  await schemaReady;
}

// Back-compat alias used by settings helpers
export async function ensureUserSettingsTable(): Promise<void> {
  await ensureAppSchema();
}
