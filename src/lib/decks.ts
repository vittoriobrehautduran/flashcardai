import { eq, and, lte, count, sql, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { ensureAppSchema, getDb } from "@/db";
import { decks, cards, cardScheduling, type Deck, type Card } from "@/db/schema";
import {
  newFsrsCard,
  reviewCard,
  fsrsCardFromScheduling,
  schedulingFromFsrsCard,
  type Grade,
} from "@/lib/fsrs";
import {
  isCurrentUserAdmin,
  NON_ADMIN_MODULE_LIMIT,
} from "@/lib/auth/require-user";

export interface DeckWithStats extends Deck {
  cardCount: number;
  dueCount: number;
  newCount: number;
}

export class ModuleLimitError extends Error {
  limit: number;

  constructor(limit: number) {
    super(
      `Non-admin users can have at most ${limit} modules. Delete one to create another.`
    );
    this.name = "ModuleLimitError";
    this.limit = limit;
  }
}

export async function listDecks(userId: string): Promise<DeckWithStats[]> {
  await ensureAppSchema();
  const db = getDb();
  const now = new Date();

  const allDecks = await db
    .select()
    .from(decks)
    .where(eq(decks.userId, userId))
    .orderBy(desc(decks.updatedAt));

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

export async function countDecksForUser(userId: string): Promise<number> {
  await ensureAppSchema();
  const db = getDb();
  const [row] = await db
    .select({ total: count() })
    .from(decks)
    .where(eq(decks.userId, userId));
  return row?.total ?? 0;
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  await ensureAppSchema();
  const db = getDb();
  const [deck] = await db.select().from(decks).where(eq(decks.id, id)).limit(1);
  return deck;
}

// Only returns the deck if it belongs to this user.
export async function getDeckForUser(
  id: string,
  userId: string
): Promise<Deck | undefined> {
  await ensureAppSchema();
  const db = getDb();
  const [deck] = await db
    .select()
    .from(decks)
    .where(and(eq(decks.id, id), eq(decks.userId, userId)))
    .limit(1);
  return deck;
}

export async function createDeck(
  userId: string,
  name: string,
  description?: string
): Promise<Deck> {
  await ensureAppSchema();
  const db = getDb();

  const admin = await isCurrentUserAdmin(userId);
  if (!admin) {
    const existing = await countDecksForUser(userId);
    if (existing >= NON_ADMIN_MODULE_LIMIT) {
      throw new ModuleLimitError(NON_ADMIN_MODULE_LIMIT);
    }
  }

  const now = new Date();
  const deck: Deck = {
    id: uuid(),
    userId,
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
  userId: string,
  name: string,
  description?: string
): Promise<Deck | undefined> {
  await ensureAppSchema();
  const db = getDb();
  const now = new Date();
  await db
    .update(decks)
    .set({ name, description: description ?? null, updatedAt: now })
    .where(and(eq(decks.id, id), eq(decks.userId, userId)));
  return getDeckForUser(id, userId);
}

export async function deleteDeck(id: string, userId: string): Promise<boolean> {
  await ensureAppSchema();
  const db = getDb();
  const owned = await getDeckForUser(id, userId);
  if (!owned) return false;
  await db.delete(decks).where(and(eq(decks.id, id), eq(decks.userId, userId)));
  return true;
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

// Delete a card only if it belongs to a deck owned by this user.
export async function deleteCardForUser(
  cardId: string,
  userId: string
): Promise<boolean> {
  await ensureAppSchema();
  const db = getDb();
  const [row] = await db
    .select({ cardId: cards.id })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(and(eq(cards.id, cardId), eq(decks.userId, userId)))
    .limit(1);

  if (!row) return false;
  await db.delete(cards).where(eq(cards.id, cardId));
  return true;
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
