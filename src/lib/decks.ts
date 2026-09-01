import { eq, and, lte, count, sql, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { getDb } from "@/db";
import { decks, cards, cardScheduling, type Deck, type Card } from "@/db/schema";
import {
  newFsrsCard,
  reviewCard,
  fsrsCardFromScheduling,
  schedulingFromFsrsCard,
  type Grade,
} from "@/lib/fsrs";

export interface DeckWithStats extends Deck {
  cardCount: number;
  dueCount: number;
  newCount: number;
}

export function listDecks(): DeckWithStats[] {
  const db = getDb();
  const now = new Date();

  const allDecks = db.select().from(decks).orderBy(desc(decks.updatedAt)).all();

  return allDecks.map((deck) => {
    const stats = db
      .select({
        total: count(),
        due: sql<number>`sum(case when ${cardScheduling.due} <= ${now.getTime()} then 1 else 0 end)`,
        newCards: sql<number>`sum(case when ${cardScheduling.reps} = 0 then 1 else 0 end)`,
      })
      .from(cards)
      .leftJoin(cardScheduling, eq(cards.id, cardScheduling.cardId))
      .where(eq(cards.deckId, deck.id))
      .get();

    return {
      ...deck,
      cardCount: stats?.total ?? 0,
      dueCount: Number(stats?.due ?? 0),
      newCount: Number(stats?.newCards ?? 0),
    };
  });
}

export function getDeck(id: string): Deck | undefined {
  const db = getDb();
  return db.select().from(decks).where(eq(decks.id, id)).get();
}

export function createDeck(name: string, description?: string): Deck {
  const db = getDb();
  const now = new Date();
  const deck: Deck = {
    id: uuid(),
    name,
    description: description ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(decks).values(deck).run();
  return deck;
}

export function updateDeck(id: string, name: string, description?: string): Deck | undefined {
  const db = getDb();
  const now = new Date();
  db.update(decks)
    .set({ name, description: description ?? null, updatedAt: now })
    .where(eq(decks.id, id))
    .run();
  return getDeck(id);
}

export function deleteDeck(id: string): void {
  const db = getDb();
  db.delete(decks).where(eq(decks.id, id)).run();
}

export function listCards(deckId: string): Card[] {
  const db = getDb();
  return db.select().from(cards).where(eq(cards.deckId, deckId)).orderBy(cards.createdAt).all();
}

export function createCard(
  deckId: string,
  front: string,
  back: string,
  sourceSection?: string
): Card {
  const db = getDb();
  const now = new Date();
  const card: Card = {
    id: uuid(),
    deckId,
    front,
    back,
    sourceSection: sourceSection ?? null,
    createdAt: now,
  };

  db.insert(cards).values(card).run();

  const fsrsCard = newFsrsCard(now);
  db.insert(cardScheduling).values({
    cardId: card.id,
    due: fsrsCard.due,
    stability: fsrsCard.stability,
    difficulty: fsrsCard.difficulty,
    elapsedDays: fsrsCard.elapsed_days,
    scheduledDays: fsrsCard.scheduled_days,
    reps: fsrsCard.reps,
    lapses: fsrsCard.lapses,
    state: fsrsCard.state,
    lastReview: null,
  }).run();

  db.update(decks).set({ updatedAt: now }).where(eq(decks.id, deckId)).run();

  return card;
}

export function createCardsBatch(
  deckId: string,
  items: Array<{ front: string; back: string; sourceSection?: string }>
): Card[] {
  return items.map((item) =>
    createCard(deckId, item.front, item.back, item.sourceSection)
  );
}

export function deleteCard(cardId: string): void {
  const db = getDb();
  db.delete(cards).where(eq(cards.id, cardId)).run();
}

export interface StudyCard {
  id: string;
  front: string;
  back: string;
  scheduling: {
    due: Date;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    state: number;
    lastReview: Date | null;
  };
}

export function getDueCards(deckId: string, limit = 50): StudyCard[] {
  const db = getDb();
  const now = new Date();

  const rows = db
    .select({
      id: cards.id,
      front: cards.front,
      back: cards.back,
      due: cardScheduling.due,
      stability: cardScheduling.stability,
      difficulty: cardScheduling.difficulty,
      elapsedDays: cardScheduling.elapsedDays,
      scheduledDays: cardScheduling.scheduledDays,
      reps: cardScheduling.reps,
      lapses: cardScheduling.lapses,
      state: cardScheduling.state,
      lastReview: cardScheduling.lastReview,
    })
    .from(cards)
    .innerJoin(cardScheduling, eq(cards.id, cardScheduling.cardId))
    .where(and(eq(cards.deckId, deckId), lte(cardScheduling.due, now)))
    .limit(limit)
    .all();

  return rows.map((row) => ({
    id: row.id,
    front: row.front,
    back: row.back,
    scheduling: {
      due: row.due,
      stability: row.stability,
      difficulty: row.difficulty,
      elapsedDays: row.elapsedDays,
      scheduledDays: row.scheduledDays,
      reps: row.reps,
      lapses: row.lapses,
      state: row.state,
      lastReview: row.lastReview,
    },
  }));
}

export function submitReview(cardId: string, rating: Grade): void {
  const db = getDb();
  const now = new Date();

  const row = db
    .select()
    .from(cardScheduling)
    .where(eq(cardScheduling.cardId, cardId))
    .get();

  if (!row) return;

  const fsrsCard = fsrsCardFromScheduling({
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsedDays: row.elapsedDays,
    scheduledDays: row.scheduledDays,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    lastReview: row.lastReview,
  });

  const result = reviewCard(fsrsCard, rating, now);
  const updated = schedulingFromFsrsCard(result.card);

  db.update(cardScheduling)
    .set({
      due: updated.due,
      stability: updated.stability,
      difficulty: updated.difficulty,
      elapsedDays: updated.elapsedDays,
      scheduledDays: updated.scheduledDays,
      reps: updated.reps,
      lapses: updated.lapses,
      state: updated.state,
      lastReview: updated.lastReview,
    })
    .where(eq(cardScheduling.cardId, cardId))
    .run();
}
