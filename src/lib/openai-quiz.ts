import { formatAiError, generateJson } from "@/lib/gemini";
import type { QuizQuestion, QuizCard } from "@/lib/quiz";
import { shuffle } from "@/lib/quiz";

export interface QuizDistractorInput {
  cardId: string;
  prompt: string;
  correctAnswer: string;
}

export interface WrittenAnswerEvaluation {
  scorePercent: number;
  isCorrect: boolean;
  feedback: string;
  betterAnswer: string;
}

export async function generateQuizQuestionsWithAi(
  cards: QuizCard[],
  questionCount: number,
  language: "en" | "sv"
): Promise<QuizQuestion[]> {
  const selected = shuffle(cards).slice(0, Math.min(questionCount, cards.length));
  const batches: QuizDistractorInput[][] = [];

  for (let i = 0; i < selected.length; i += 4) {
    batches.push(
      selected.slice(i, i + 4).map((c) => ({
        cardId: c.id,
        prompt: c.front,
        correctAnswer: c.back,
      }))
    );
  }

  const questions: QuizQuestion[] = [];

  const languageRule =
    language === "sv"
      ? "All distractors must be in Swedish."
      : "All distractors must be in English.";

  for (const batch of batches) {
    const parsed = await generateJson<{
      items?: Array<{ cardId: string; distractors: string[] }>;
    }>(
      `You create hard multiple-choice distractors for study quizzes.
${languageRule}
Distractors must be plausible, similar length, and related to the same topic — not obviously from other unrelated questions.
Never copy the correct answer. Never use joke answers.`,
      `For each item, generate 3 wrong answers (distractors) that could fool someone who half-knows the topic.

Items:
${batch
  .map(
    (item, idx) =>
      `${idx + 1}. Question: ${item.prompt}\n   Correct answer: ${item.correctAnswer}\n   cardId: ${item.cardId}`
  )
  .join("\n\n")}

Respond JSON:
{
  "items": [
    { "cardId": "...", "distractors": ["wrong1", "wrong2", "wrong3"] }
  ]
}`
    );

    for (const item of parsed.items ?? []) {
      const source = batch.find((b) => b.cardId === item.cardId);
      if (!source) continue;

      const distractors = (item.distractors ?? [])
        .map((d) => d.trim())
        .filter(
          (d) =>
            d &&
            d.toLowerCase() !== source.correctAnswer.trim().toLowerCase()
        )
        .slice(0, 3);

      while (distractors.length < 3) {
        distractors.push(
          language === "sv"
            ? `Alternativ ${distractors.length + 1}`
            : `Option ${distractors.length + 1}`
        );
      }

      const options = shuffle([
        { id: `${source.cardId}-correct`, text: source.correctAnswer, isCorrect: true },
        ...distractors.map((text, i) => ({
          id: `${source.cardId}-d-${i}`,
          text,
          isCorrect: false,
        })),
      ]);

      questions.push({
        cardId: source.cardId,
        prompt: source.prompt,
        correctAnswer: source.correctAnswer,
        options,
      });
    }
  }

  return questions;
}

export async function evaluateWrittenQuizAnswer(
  question: string,
  correctAnswer: string,
  userAnswer: string,
  language: "en" | "sv"
): Promise<WrittenAnswerEvaluation> {
  const languageRule =
    language === "sv"
      ? "Respond in Swedish."
      : "Respond in English.";

  const parsed = await generateJson<WrittenAnswerEvaluation>(
    `You grade short quiz answers for a personal study app.
${languageRule}
Be fair: accept paraphrases and minor wording differences if the core meaning is right.
scorePercent: 0-100 how complete and accurate the answer is.
isCorrect: true if scorePercent >= 70.
feedback: 1-2 sentences explaining what was right or wrong.
betterAnswer: a concise model answer showing good formulation.`,
    `Question: ${question}
Reference answer: ${correctAnswer}
Student answer: ${userAnswer}

JSON: { "scorePercent": number, "isCorrect": boolean, "feedback": string, "betterAnswer": string }`
  );

  const scorePercent = Math.max(0, Math.min(100, Math.round(parsed.scorePercent ?? 0)));

  return {
    scorePercent,
    isCorrect: parsed.isCorrect ?? scorePercent >= 70,
    feedback: parsed.feedback?.trim() ?? "",
    betterAnswer: parsed.betterAnswer?.trim() ?? correctAnswer,
  };
}

export { formatAiError as formatOpenAiError };
