import { eq, and, desc, count, sql, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { getDb } from "@/db";
import {
  cards,
  cardScheduling,
  studySessions,
  quizSessions,
} from "@/db/schema";
import {
  deserializeQuizQuestions,
  serializeQuizQuestions,
  type SerializedQuizQuestion,
} from "@/lib/quiz-session";
import type { QuizQuestion } from "@/lib/quiz";

export interface DeckProgress {
  cardCount: number;
  dueCount: number;
  newCount: number;
  studiedCount: number;
  lastStudyAt: Date | null;
  lastQuizScore: number | null;
  lastQuizPercent: number | null;
  lastQuizAt: Date | null;
  activeStudySession: {
    id: string;
    currentIndex: number;
    reviewedCount: number;
    total: number;
  } | null;
  activeQuizSession: {
    id: string;
    currentIndex: number;
    score: number;
    total: number;
  } | null;
}

export function getDeckProgress(deckId: string): DeckProgress {
  const db = getDb();
  const now = new Date();

  const stats = db
    .select({
      total: count(),
      due: sql<number>`sum(case when ${cardScheduling.due} <= ${now.getTime()} then 1 else 0 end)`,
      newCards: sql<number>`sum(case when ${cardScheduling.reps} = 0 then 1 else 0 end)`,
      studied: sql<number>`sum(case when ${cardScheduling.reps} > 0 then 1 else 0 end)`,
    })
    .from(cards)
    .leftJoin(cardScheduling, eq(cards.id, cardScheduling.cardId))
    .where(eq(cards.deckId, deckId))
    .get();

  const lastStudy = db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.deckId, deckId), eq(studySessions.status, "completed")))
    .orderBy(desc(studySessions.completedAt))
    .limit(1)
    .get();

  const lastQuiz = db
    .select()
    .from(quizSessions)
    .where(and(eq(quizSessions.deckId, deckId), eq(quizSessions.status, "completed")))
    .orderBy(desc(quizSessions.completedAt))
    .limit(1)
    .get();

  const activeStudy = db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.deckId, deckId), eq(studySessions.status, "active")))
    .get();

  const activeQuiz = db
    .select()
    .from(quizSessions)
    .where(and(eq(quizSessions.deckId, deckId), eq(quizSessions.status, "active")))
    .get();

  let activeStudySession: DeckProgress["activeStudySession"] = null;
  if (activeStudy) {
    const ids = JSON.parse(activeStudy.cardIdsJson) as string[];
    activeStudySession = {
      id: activeStudy.id,
      currentIndex: activeStudy.currentIndex,
      reviewedCount: activeStudy.reviewedCount,
      total: ids.length,
    };
  }

  let activeQuizSession: DeckProgress["activeQuizSession"] = null;
  if (activeQuiz) {
    activeQuizSession = {
      id: activeQuiz.id,
      currentIndex: activeQuiz.currentIndex,
      score: activeQuiz.score,
      total: activeQuiz.questionCount,
    };
  }

  let lastQuizPercent: number | null = null;
  if (lastQuiz && lastQuiz.questionCount > 0) {
    lastQuizPercent = Math.round((lastQuiz.score / lastQuiz.questionCount) * 100);
  }

  return {
    cardCount: stats?.total ?? 0,
    dueCount: Number(stats?.due ?? 0),
    newCount: Number(stats?.newCards ?? 0),
    studiedCount: Number(stats?.studied ?? 0),
    lastStudyAt: lastStudy?.completedAt ?? null,
    lastQuizScore: lastQuiz?.score ?? null,
    lastQuizPercent,
    lastQuizAt: lastQuiz?.completedAt ?? null,
    activeStudySession,
    activeQuizSession,
  };
}

function abandonActiveStudySessions(deckId: string) {
  const db = getDb();
  db.update(studySessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(studySessions.deckId, deckId), eq(studySessions.status, "active")))
    .run();
}

function abandonActiveQuizSessions(deckId: string) {
  const db = getDb();
  db.update(quizSessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(quizSessions.deckId, deckId), eq(quizSessions.status, "active")))
    .run();
}

export function startStudySession(deckId: string, cardIds: string[]) {
  const db = getDb();
  const now = new Date();
  abandonActiveStudySessions(deckId);

  const id = uuid();
  db.insert(studySessions).values({
    id,
    deckId,
    status: "active",
    cardIdsJson: JSON.stringify(cardIds),
    currentIndex: 0,
    reviewedCount: 0,
    startedAt: now,
    completedAt: null,
  }).run();

  return { id, cardIds, currentIndex: 0, reviewedCount: 0 };
}

export function getActiveStudySession(deckId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.deckId, deckId), eq(studySessions.status, "active")))
    .get();

  if (!row) return null;

  return {
    id: row.id,
    cardIds: JSON.parse(row.cardIdsJson) as string[],
    currentIndex: row.currentIndex,
    reviewedCount: row.reviewedCount,
  };
}

export function updateStudySession(
  sessionId: string,
  currentIndex: number,
  reviewedCount: number
) {
  const db = getDb();
  db.update(studySessions)
    .set({ currentIndex, reviewedCount })
    .where(eq(studySessions.id, sessionId))
    .run();
}

export function completeStudySession(sessionId: string) {
  const db = getDb();
  db.update(studySessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(studySessions.id, sessionId))
    .run();
}

export function abandonStudySession(sessionId: string) {
  completeStudySession(sessionId);
}

export function startQuizSession(
  deckId: string,
  questions: QuizQuestion[],
  questionCount: number,
  mode: "choice" | "written" = "choice"
) {
  const db = getDb();
  const now = new Date();
  abandonActiveQuizSessions(deckId);

  const id = uuid();
  const serialized = serializeQuizQuestions(questions);

  db.insert(quizSessions).values({
    id,
    deckId,
    status: "active",
    questionsJson: JSON.stringify(serialized),
    questionCount,
    currentIndex: 0,
    score: 0,
    wrongCardIdsJson: "[]",
    mode,
    startedAt: now,
    completedAt: null,
  }).run();

  return { id, questions, currentIndex: 0, score: 0, wrongCardIds: [] as string[], mode };
}

export function getActiveQuizSession(deckId: string, mode?: "choice" | "written") {
  const db = getDb();
  const row = db
    .select()
    .from(quizSessions)
    .where(and(eq(quizSessions.deckId, deckId), eq(quizSessions.status, "active")))
    .get();

  if (!row) return null;
  if (mode && row.mode !== mode) return null;

  const questions = deserializeQuizQuestions(
    JSON.parse(row.questionsJson) as SerializedQuizQuestion[]
  );
  const wrongCardIds = JSON.parse(row.wrongCardIdsJson || "[]") as string[];

  return {
    id: row.id,
    questions,
    questionCount: row.questionCount,
    currentIndex: row.currentIndex,
    score: row.score,
    wrongCardIds,
    mode: row.mode as "choice" | "written",
  };
}

export function updateQuizSession(
  sessionId: string,
  currentIndex: number,
  score: number,
  wrongCardIds?: string[]
) {
  const db = getDb();
  const updates: {
    currentIndex: number;
    score: number;
    wrongCardIdsJson?: string;
  } = { currentIndex, score };

  if (wrongCardIds) {
    updates.wrongCardIdsJson = JSON.stringify(wrongCardIds);
  }

  db.update(quizSessions)
    .set(updates)
    .where(eq(quizSessions.id, sessionId))
    .run();
}

export function completeQuizSession(sessionId: string, score: number) {
  const db = getDb();
  db.update(quizSessions)
    .set({ status: "completed", completedAt: new Date(), score })
    .where(eq(quizSessions.id, sessionId))
    .run();
}

export function abandonQuizSession(sessionId: string) {
  const db = getDb();
  db.update(quizSessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(quizSessions.id, sessionId))
    .run();
}

export function getCardsByIds(cardIds: string[]) {
  const db = getDb();
  if (cardIds.length === 0) return [];

  const rows = db.select().from(cards).where(inArray(cards.id, cardIds)).all();
  const map = new Map(rows.map((c) => [c.id, c]));

  return cardIds
    .map((id) => map.get(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .map((c) => ({ id: c.id, front: c.front, back: c.back }));
}
