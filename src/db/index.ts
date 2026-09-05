// Neon Postgres client for local + Amplify.
// Uses the serverless HTTP driver so it works in Node and on Amplify SSR.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function getConnectionString() {
  const url = process.env.NEON_CONNECTION_STRING;
  if (!url) {
    throw new Error(
      "NEON_CONNECTION_STRING is missing. Add it to .env (local) or Amplify env vars."
    );
  }
  return url;
}

let db: ReturnType<typeof createDatabase> | null = null;

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
