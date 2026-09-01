import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";

const params = generatorParameters({ enable_fuzz: true });
const scheduler = fsrs(params);

export function newFsrsCard(now = new Date()): FsrsCard {
  return createEmptyCard(now);
}

export function reviewCard(card: FsrsCard, rating: Grade, now = new Date()) {
  const record = scheduler.next(card, now, rating);
  return record;
}

export { Rating, type Grade };

export function fsrsCardFromScheduling(row: {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
}): FsrsCard {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.lastReview ?? undefined,
  };
}

export function schedulingFromFsrsCard(card: FsrsCard) {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  };
}
