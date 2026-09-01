import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const decks = sqliteTable("decks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  deckId: text("deck_id")
    .notNull()
    .references(() => decks.id, { onDelete: "cascade" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  sourceSection: text("source_section"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// FSRS scheduling state per card
export const cardScheduling = sqliteTable("card_scheduling", {
  cardId: text("card_id")
    .primaryKey()
    .references(() => cards.id, { onDelete: "cascade" }),
  due: integer("due", { mode: "timestamp" }).notNull(),
  stability: real("stability").notNull(),
  difficulty: real("difficulty").notNull(),
  elapsedDays: integer("elapsed_days").notNull().default(0),
  scheduledDays: integer("scheduled_days").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  state: integer("state").notNull().default(0),
  lastReview: integer("last_review", { mode: "timestamp" }),
});

export const studySessions = sqliteTable("study_sessions", {
  id: text("id").primaryKey(),
  deckId: text("deck_id")
    .notNull()
    .references(() => decks.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // active | completed
  cardIdsJson: text("card_ids_json").notNull(),
  currentIndex: integer("current_index").notNull().default(0),
  reviewedCount: integer("reviewed_count").notNull().default(0),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const quizSessions = sqliteTable("quiz_sessions", {
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
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export type Deck = typeof decks.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type CardScheduling = typeof cardScheduling.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type QuizSession = typeof quizSessions.$inferSelect;
