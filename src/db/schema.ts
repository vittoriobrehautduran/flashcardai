import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const decks = pgTable("decks", {
  id: text("id").primaryKey(),
  // Cognito sub (or "local" when auth is off)
  userId: text("user_id").notNull().default("local"),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  deckId: text("deck_id")
    .notNull()
    .references(() => decks.id, { onDelete: "cascade" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  sourceSection: text("source_section"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// FSRS scheduling state per card
export const cardScheduling = pgTable("card_scheduling", {
  cardId: text("card_id")
    .primaryKey()
    .references(() => cards.id, { onDelete: "cascade" }),
  due: timestamp("due", { withTimezone: true }).notNull(),
  stability: doublePrecision("stability").notNull(),
  difficulty: doublePrecision("difficulty").notNull(),
  elapsedDays: integer("elapsed_days").notNull().default(0),
  scheduledDays: integer("scheduled_days").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  state: integer("state").notNull().default(0),
  lastReview: timestamp("last_review", { withTimezone: true }),
});

export const studySessions = pgTable("study_sessions", {
  id: text("id").primaryKey(),
  deckId: text("deck_id")
    .notNull()
    .references(() => decks.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // active | completed
  cardIdsJson: text("card_ids_json").notNull(),
  currentIndex: integer("current_index").notNull().default(0),
  reviewedCount: integer("reviewed_count").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const quizSessions = pgTable("quiz_sessions", {
  id: text("id").primaryKey(),
  deckId: text("deck_id")
    .notNull()
    .references(() => decks.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // active | completed
  questionsJson: text("questions_json").notNull(),
  questionCount: integer("question_count").notNull(),
  currentIndex: integer("current_index").notNull().default(0),
  score: integer("score").notNull().default(0),
  wrongCardIdsJson: text("wrong_card_ids_json").notNull().default("[]"),
  mode: text("mode").notNull().default("choice"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// Per-user app settings. userId = Cognito sub, or "local" when auth is off.
export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  email: text("email"),
  isAdmin: boolean("is_admin").notNull().default(false),
  // AES-GCM ciphertext of the user's own Gemini API key (never store plaintext).
  geminiApiKeyEncrypted: text("gemini_api_key_encrypted"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type Deck = typeof decks.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type CardScheduling = typeof cardScheduling.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type QuizSession = typeof quizSessions.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
