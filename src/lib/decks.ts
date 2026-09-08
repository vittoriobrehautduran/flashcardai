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
import { NON_ADMIN_MODULE_LIMIT } from "@/lib/auth/require-user";
import {
  CACHE_TTL,
  cacheGet,
  cacheKeys,
  cacheSet,
  invalidateModuleData,
  invalidateUserModuleList,
} from "@/lib/ttl-cache";

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
  const key = cacheKeys.moduleList(userId);
  const cached = cacheGet<DeckWithStats[]>(key);
  if (cached) return cached;

  const db = getDb();
  const now = new Date();

  // One query for all modules + counts (avoids N extra round trips).
  const rows = await db
    .select({
      id: decks.id,
      userId: decks.userId,
      name: decks.name,
      description: decks.description,
      createdAt: decks.createdAt,
      updatedAt: decks.updatedAt,
      cardCount: sql<number>`coalesce(count(${cards.id}), 0)`,
      dueCount: sql<number>`coalesce(sum(case when ${cardScheduling.due} <= ${now} then 1 else 0 end), 0)`,
      newCount: sql<number>`coalesce(sum(case when ${cardScheduling.reps} = 0 then 1 else 0 end), 0)`,
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .leftJoin(cardScheduling, eq(cards.id, cardScheduling.cardId))
    .where(eq(decks.userId, userId))
    .groupBy(
      decks.id,
      decks.userId,
      decks.name,
      decks.description,
      decks.createdAt,
      decks.updatedAt
    )
    .orderBy(desc(decks.updatedAt));

  const result = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    cardCount: Number(row.cardCount ?? 0),
    dueCount: Number(row.dueCount ?? 0),
    newCount: Number(row.newCount ?? 0),
  }));

  cacheSet(key, result, CACHE_TTL.moduleListMs);
  return result;
}

export async function countDecksForUser(userId: string): Promise<number> {
  // Reuse the module list cache when warm so create-limit checks stay cheap.
  const cached = cacheGet<DeckWithStats[]>(cacheKeys.moduleList(userId));
  if (cached) return cached.length;

  const db = getDb();
  const [row] = await db
    .select({ total: count() })
    .from(decks)
    .where(eq(decks.userId, userId));
  return row?.total ?? 0;
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const db = getDb();
  const [deck] = await db.select().from(decks).where(eq(decks.id, id)).limit(1);
  return deck;
}

// Only returns the deck if it belongs to this user.
export async function getDeckForUser(
  id: string,
  userId: string
): Promise<Deck | undefined> {
  const key = cacheKeys.module(userId, id);
  const cached = cacheGet<Deck | null>(key);
  if (cached !== undefined) return cached ?? undefined;

  const db = getDb();
  const [deck] = await db
    .select()
    .from(decks)
    .where(and(eq(decks.id, id), eq(decks.userId, userId)))
    .limit(1);

  cacheSet(key, deck ?? null, CACHE_TTL.moduleMs);
  return deck;
}

export async function createDeck(
  userId: string,
  name: string,
  description: string | undefined,
  isAdmin: boolean
): Promise<Deck> {
  const db = getDb();

  if (!isAdmin) {
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
  invalidateUserModuleList(userId);
  return deck;
}

export async function updateDeck(
  id: string,
  userId: string,
  name: string,
  description?: string
): Promise<Deck | undefined> {
  const db = getDb();
  const now = new Date();
  await db
    .update(decks)
    .set({ name, description: description ?? null, updatedAt: now })
    .where(and(eq(decks.id, id), eq(decks.userId, userId)));
  invalidateModuleData(userId, id);
  return getDeckForUser(id, userId);
}

export async function deleteDeck(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const owned = await getDeckForUser(id, userId);
  if (!owned) return false;
  await db.delete(decks).where(and(eq(decks.id, id), eq(decks.userId, userId)));
  invalidateModuleData(userId, id);
  return true;
}

export async function listCards(deckId: string): Promise<Card[]> {
  const key = cacheKeys.cards(deckId);
  const cached = cacheGet<Card[]>(key);
  if (cached) return cached;

  const db = getDb();
  const result = await db
    .select()
    .from(cards)
    .where(eq(cards.deckId, deckId))
    .orderBy(cards.createdAt);

  cacheSet(key, result, CACHE_TTL.cardsMs);
  return result;
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

  const [owner] = await db
    .select({ userId: decks.userId })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);
  if (owner) invalidateModuleData(owner.userId, deckId);

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
  const db = getDb();
  const [row] = await db
    .select({ cardId: cards.id, deckId: cards.deckId })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(and(eq(cards.id, cardId), eq(decks.userId, userId)))
    .limit(1);

  if (!row) return false;
  await db.delete(cards).where(eq(cards.id, cardId));
  invalidateModuleData(userId, row.deckId);
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

  // Clear progress/list caches for this card's module so due counts stay honest.
  const [owned] = await db
    .select({ deckId: cards.deckId, userId: decks.userId })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(eq(cards.id, cardId))
    .limit(1);
  if (owned) invalidateModuleData(owned.userId, owned.deckId);
}
