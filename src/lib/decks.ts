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

export async function listDecks(): Promise<DeckWithStats[]> {
  const db = getDb();
  const now = new Date();

  const allDecks = await db.select().from(decks).orderBy(desc(decks.updatedAt));

  const result: DeckWithStats[] = [];
  for (const deck of allDecks) {
    const [stats] = await db
      .select({
        total: count(),
        due: sql<number>`sum(case when ${cardScheduling.due} <= ${now} then 1 else 0 end)`,
        newCards: sql<number>`sum(case when ${cardScheduling.reps} = 0 then 1 else 0 end)`,
      })
      .from(cards)
      .leftJoin(cardScheduling, eq(cards.id, cardScheduling.cardId))
      .where(eq(cards.deckId, deck.id));

    result.push({
      ...deck,
      cardCount: stats?.total ?? 0,
      dueCount: Number(stats?.due ?? 0),
      newCount: Number(stats?.newCards ?? 0),
    });
  }

  return result;
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const db = getDb();
  const [deck] = await db.select().from(decks).where(eq(decks.id, id)).limit(1);
  return deck;
}

export async function createDeck(name: string, description?: string): Promise<Deck> {
  const db = getDb();
  const now = new Date();
  const deck: Deck = {
    id: uuid(),
    name,
    description: description ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(decks).values(deck);
  return deck;
}

export async function updateDeck(
  id: string,
  name: string,
  description?: string
): Promise<Deck | undefined> {
  const db = getDb();
  const now = new Date();
  await db
    .update(decks)
    .set({ name, description: description ?? null, updatedAt: now })
    .where(eq(decks.id, id));
  return getDeck(id);
}

export async function deleteDeck(id: string): Promise<void> {
  const db = getDb();
  await db.delete(decks).where(eq(decks.id, id));
}

export async function listCards(deckId: string): Promise<Card[]> {
  const db = getDb();
  return db.select().from(cards).where(eq(cards.deckId, deckId)).orderBy(cards.createdAt);
}

export async function createCard(
  deckId: string,
  front: string,
  back: string,
  sourceSection?: string
): Promise<Card> {
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

  await db.insert(cards).values(card);

  const fsrsCard = newFsrsCard(now);
  await db.insert(cardScheduling).values({
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
  });

  await db.update(decks).set({ updatedAt: now }).where(eq(decks.id, deckId));

  return card;
}

export async function createCardsBatch(
  deckId: string,
  items: Array<{ front: string; back: string; sourceSection?: string }>
): Promise<Card[]> {
  const created: Card[] = [];
  for (const item of items) {
    created.push(await createCard(deckId, item.front, item.back, item.sourceSection));
  }
  return created;
}

export async function deleteCard(cardId: string): Promise<void> {
  const db = getDb();
  await db.delete(cards).where(eq(cards.id, cardId));
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

export async function getDueCards(deckId: string, limit = 50): Promise<StudyCard[]> {
  const db = getDb();
  const now = new Date();

  const rows = await db
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
    .limit(limit);

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

export async function submitReview(cardId: string, rating: Grade): Promise<void> {
  const db = getDb();
  const now = new Date();

  const [row] = await db
    .select()
    .from(cardScheduling)
    .where(eq(cardScheduling.cardId, cardId))
    .limit(1);

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

  await db
    .update(cardScheduling)
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
    .where(eq(cardScheduling.cardId, cardId));
}
