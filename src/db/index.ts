import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import * as schema from "./schema";

const dbPath = join(process.cwd(), "data", "flashcardai.db");

function createDatabase() {
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      source_section TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS card_scheduling (
      card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
      due INTEGER NOT NULL,
      stability REAL NOT NULL,
      difficulty REAL NOT NULL,
      elapsed_days INTEGER NOT NULL DEFAULT 0,
      scheduled_days INTEGER NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      state INTEGER NOT NULL DEFAULT 0,
      last_review INTEGER
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      card_ids_json TEXT NOT NULL,
      current_index INTEGER NOT NULL DEFAULT 0,
      reviewed_count INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      question_count INTEGER NOT NULL,
      current_index INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      wrong_card_ids_json TEXT NOT NULL DEFAULT '[]',
      mode TEXT NOT NULL DEFAULT 'choice',
      started_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `);

  // Migrations for existing databases
  try {
    sqlite.exec(`ALTER TABLE quiz_sessions ADD COLUMN wrong_card_ids_json TEXT NOT NULL DEFAULT '[]'`);
  } catch {
    // column already exists
  }
  try {
    sqlite.exec(`ALTER TABLE quiz_sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'choice'`);
  } catch {
    // column already exists
  }

  return drizzle(sqlite, { schema });
}

let db: ReturnType<typeof createDatabase> | null = null;

export function getDb() {
  if (!db) {
    db = createDatabase();
  }
  return db;
}
