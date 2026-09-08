// Tiny in-memory TTL cache for hot API reads.
// On Amplify this lives only on one warm server instance — still useful:
// if the same user opens Modules twice in a minute, we skip Neon.

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const store = new Map<string, CacheEntry>();

// Soft cap so a busy process cannot grow the map forever.
const MAX_ENTRIES = 500;

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  if (store.size >= MAX_ENTRIES) {
    // Drop expired first; if still full, drop oldest inserted key.
    const now = Date.now();
    for (const [k, entry] of store) {
      if (entry.expiresAt <= now) store.delete(k);
    }
    if (store.size >= MAX_ENTRIES) {
      const first = store.keys().next().value;
      if (first) store.delete(first);
    }
  }

  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

// Remove every key that starts with the prefix (e.g. "decks:u123:").
export function cacheDeletePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

// Cache key helpers — keep naming consistent across the app.
export const cacheKeys = {
  moduleList: (userId: string) => `modules:list:${userId}`,
  module: (userId: string, deckId: string) => `modules:one:${userId}:${deckId}`,
  progress: (deckId: string) => `modules:progress:${deckId}`,
  cards: (deckId: string) => `modules:cards:${deckId}`,
};

// After any write that changes a user's modules / questions / progress.
export function invalidateUserModuleList(userId: string): void {
  cacheDelete(cacheKeys.moduleList(userId));
}

export function invalidateModuleData(userId: string, deckId: string): void {
  cacheDelete(cacheKeys.moduleList(userId));
  cacheDelete(cacheKeys.module(userId, deckId));
  cacheDelete(cacheKeys.progress(deckId));
  cacheDelete(cacheKeys.cards(deckId));
}

// Short TTLs: stale study counts for a few seconds is fine; long caches feel "broken".
export const CACHE_TTL = {
  moduleListMs: 45_000, // 45s
  moduleMs: 45_000,
  progressMs: 20_000, // progress changes more often while studying
  cardsMs: 60_000,
} as const;
