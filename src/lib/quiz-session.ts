import type { QuizQuestion } from "@/lib/quiz";

export interface SerializedQuizQuestion {
  cardId: string;
  prompt: string;
  correctAnswer: string;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
}

export function serializeQuizQuestions(questions: QuizQuestion[]): SerializedQuizQuestion[] {
  return questions.map((q) => ({
    cardId: q.cardId,
    prompt: q.prompt,
    correctAnswer: q.correctAnswer,
    options: q.options.map((o) => ({
      id: o.id,
      text: o.text,
      isCorrect: o.isCorrect,
    })),
  }));
}

export function deserializeQuizQuestions(data: SerializedQuizQuestion[]): QuizQuestion[] {
  return data.map((q) => ({
    cardId: q.cardId,
    prompt: q.prompt,
    correctAnswer: q.correctAnswer,
    options: q.options,
  }));
}
