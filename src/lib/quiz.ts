export interface QuizCard {
  id: string;
  front: string;
  back: string;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  cardId: string;
  prompt: string;
  correctAnswer: string;
  options: QuizOption[];
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickDistractors(allCards: QuizCard[], correctCard: QuizCard, count: number): QuizCard[] {
  const pool = allCards.filter((c) => c.id !== correctCard.id);
  const uniqueByBack = new Map<string, QuizCard>();

  for (const card of shuffle(pool)) {
    const key = card.back.trim().toLowerCase();
    if (key === correctCard.back.trim().toLowerCase()) continue;
    if (!uniqueByBack.has(key)) {
      uniqueByBack.set(key, card);
    }
    if (uniqueByBack.size >= count) break;
  }

  return Array.from(uniqueByBack.values());
}

export function buildQuizQuestions(cards: QuizCard[], questionCount: number): QuizQuestion[] {
  if (cards.length === 0) return [];

  const selected = shuffle(cards).slice(0, Math.min(questionCount, cards.length));

  return selected.map((card) => {
    const distractorCount = Math.min(3, cards.length - 1);
    const distractors = pickDistractors(cards, card, distractorCount);

    const options: QuizOption[] = shuffle([
      { id: `${card.id}-correct`, text: card.back, isCorrect: true },
      ...distractors.map((d) => ({
        id: `${d.id}-distractor`,
        text: d.back,
        isCorrect: false,
      })),
    ]);

    return {
      cardId: card.id,
      prompt: card.front,
      correctAnswer: card.back,
      options,
    };
  });
}

export function canRunMultipleChoiceQuiz(cards: QuizCard[]): boolean {
  return cards.length >= 1;
}

export function canRunWrittenQuiz(cards: QuizCard[]): boolean {
  return cards.length >= 1;
}

export function buildWrittenQuestions(cards: QuizCard[], questionCount: number) {
  if (cards.length === 0) return [];
  const selected = shuffle(cards).slice(0, Math.min(questionCount, cards.length));
  return selected.map((card) => ({
    cardId: card.id,
    prompt: card.front,
    correctAnswer: card.back,
    options: [],
  }));
}

export function getQuizQuestionCountOptions(cardCount: number): number[] {
  const presets = [5, 10, 15, 20];
  const options = presets.filter((n) => n <= cardCount);
  if (!options.includes(cardCount)) {
    options.push(cardCount);
  }
  return options.sort((a, b) => a - b);
}
