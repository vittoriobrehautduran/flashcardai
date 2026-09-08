// AI helpers for math practice mode.
// Handles exercise extraction from PDFs, exercise generation, and answer grading (text + image).

import { generateJson, formatAiError, callWithRetryExported, GEMINI_MODEL, MissingGeminiApiKeyError } from "@/lib/gemini";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getUserGeminiApiKey } from "@/lib/user-settings";

export interface MathExercise {
  id: string;
  problem: string;
  hasSolution: boolean;
  solution?: string;
}

export interface ExerciseExtractionResult {
  exercises: MathExercise[];
  source: "extracted" | "generated";
  topic: string;
}

export interface MathEvaluation {
  scorePercent: number;
  isCorrect: boolean;
  feedback: string;
  modelSolution: string;
}

export interface LessonStep {
  id: string;
  title: string;
  explanation: string;
  example: string;
  tip: string;
}

export interface MathLesson {
  topic: string;
  steps: LessonStep[];
}

export interface LessonHelpResult {
  content: string;
  quizQuestion?: string;
  quizHint?: string;
}

const EXTRACT_SYSTEM_PROMPT = `You are a math teacher assistant that analyzes math documents.

Your job:
1. Read the provided text from a math PDF.
2. If it contains exercises, problems, or tasks for the student to solve — extract them.
3. If it only contains theory, notes, or lecture material with NO exercises — generate 5-8 practice exercises based on the topics covered.

Rules:
- Each exercise must have a clear problem statement.
- If the document includes solutions/answers, include them in the "solution" field.
- If no solution is provided in the document, set hasSolution to false and leave solution empty.
- When generating exercises, create a mix of difficulties (easy to challenging).
- Preserve any mathematical notation as-is (use standard math text notation like x^2, sqrt(x), fractions as a/b, etc.).
- Give each exercise a unique id like "ex-1", "ex-2", etc.
- Detect the main topic/subject of the document.`;

function buildExtractPrompt(text: string, language: "en" | "sv"): string {
  const languageRule =
    language === "sv"
      ? "Write all exercise text in Swedish. If the source is in Swedish, keep the original wording."
      : "Write all exercise text in English.";

  return `Analyze this math document and extract or generate exercises.
${languageRule}

DOCUMENT TEXT:
${text}

Respond with JSON:
{
  "exercises": [
    { "id": "ex-1", "problem": "...", "hasSolution": true, "solution": "..." }
  ],
  "source": "extracted" or "generated",
  "topic": "short description of the math topic"
}`;
}

// Extract exercises from PDF text, or generate them if none found.
export async function extractOrGenerateExercises(
  text: string,
  language: "en" | "sv"
): Promise<ExerciseExtractionResult> {
  const result = await generateJson<ExerciseExtractionResult>(
    EXTRACT_SYSTEM_PROMPT,
    buildExtractPrompt(text, language)
  );

  const exercises = (result.exercises ?? []).map((ex, i) => ({
    id: ex.id || `ex-${i + 1}`,
    problem: ex.problem?.trim() ?? "",
    hasSolution: Boolean(ex.hasSolution),
    solution: ex.solution?.trim() || undefined,
  }));

  return {
    exercises: exercises.filter((ex) => ex.problem),
    source: result.source === "extracted" ? "extracted" : "generated",
    topic: result.topic?.trim() ?? "Mathematics",
  };
}

const GRADE_SYSTEM_PROMPT = `You are a strict but fair math teacher grading student solutions.

Rules:
- Evaluate the mathematical correctness of the student's answer.
- Check if the approach/method is valid, not just the final answer.
- scorePercent: 0-100 based on correctness and completeness.
- isCorrect: true if scorePercent >= 70.
- feedback: 2-3 sentences. Be specific: what was right, what was wrong, and how to improve.
- modelSolution: provide a clear, step-by-step solution to the problem.
- Accept equivalent forms (e.g. 1/2 = 0.5 = 50%).
- If the student's work shows understanding but has a calculation error, give partial credit.`;

function buildGradePrompt(
  exercise: string,
  userAnswer: string,
  language: "en" | "sv"
): string {
  const languageRule = language === "sv" ? "Respond in Swedish." : "Respond in English.";

  return `${languageRule}

Problem: ${exercise}

Student's answer: ${userAnswer}

JSON: { "scorePercent": number, "isCorrect": boolean, "feedback": "string", "modelSolution": "string" }`;
}

// Grade a typed text answer for a math exercise.
export async function gradeMathAnswer(
  exercise: string,
  userAnswer: string,
  language: "en" | "sv"
): Promise<MathEvaluation> {
  const parsed = await generateJson<MathEvaluation>(
    GRADE_SYSTEM_PROMPT,
    buildGradePrompt(exercise, userAnswer, language)
  );

  const scorePercent = Math.max(0, Math.min(100, Math.round(parsed.scorePercent ?? 0)));

  return {
    scorePercent,
    isCorrect: parsed.isCorrect ?? scorePercent >= 70,
    feedback: parsed.feedback?.trim() ?? "",
    modelSolution: parsed.modelSolution?.trim() ?? "",
  };
}

// Grade a handwritten solution from a photo using Gemini Vision.
export async function gradeMathImage(
  exercise: string,
  imageBase64: string,
  mimeType: string,
  language: "en" | "sv"
): Promise<MathEvaluation> {
  const languageRule = language === "sv" ? "Respond in Swedish." : "Respond in English.";

  return callWithRetryExported(async () => {
    const apiKey = await getUserGeminiApiKey();
    if (!apiKey) throw new MissingGeminiApiKeyError();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
      {
        text: `${languageRule}

You are a strict but fair math teacher. The student was given this problem:

Problem: ${exercise}

The attached image shows the student's handwritten solution. Analyze it carefully:
- Read the handwritten math notation
- Check if the approach and calculations are correct
- Give partial credit for correct reasoning with calculation errors

Respond with JSON:
{ "scorePercent": number (0-100), "isCorrect": boolean (true if >= 70), "feedback": "2-3 sentences about what was right/wrong and how to improve", "modelSolution": "step-by-step correct solution" }`,
      },
    ]);

    const raw = result.response.text();
    if (!raw) throw new Error("Empty response from Gemini");

    const parsed = JSON.parse(raw) as MathEvaluation;
    const scorePercent = Math.max(0, Math.min(100, Math.round(parsed.scorePercent ?? 0)));

    return {
      scorePercent,
      isCorrect: parsed.isCorrect ?? scorePercent >= 70,
      feedback: parsed.feedback?.trim() ?? "",
      modelSolution: parsed.modelSolution?.trim() ?? "",
    };
  });
}

const LESSON_SYSTEM_PROMPT = `You are a patient math teacher who builds a clear step-by-step lesson from a document.

Your job:
1. Read the document text (theory and/or exercises).
2. Teach the core topic from first principles to useful practice.
3. Split the lesson into 5–8 ordered steps a student can follow one at a time.

Rules:
- Each step needs: short title, clear explanation, one worked example, one practical tip.
- Stay faithful to the document's topic; do not invent unrelated chapters.
- Use plain math text notation (x^2, sqrt(x), a/b).
- Keep explanations short and readable (about 3–6 sentences per step).
- Examples should show the reasoning, not only the final answer.
- Detect a short topic title for the whole lesson.`;

function buildLessonPrompt(text: string, language: "en" | "sv"): string {
  const languageRule =
    language === "sv"
      ? "Write the entire lesson in Swedish."
      : "Write the entire lesson in English.";

  return `Build a step-by-step lesson from this math document.
${languageRule}

DOCUMENT TEXT:
${text}

Respond with JSON:
{
  "topic": "short topic title",
  "steps": [
    {
      "id": "step-1",
      "title": "...",
      "explanation": "...",
      "example": "...",
      "tip": "..."
    }
  ]
}`;
}

// Turn document text into an ordered teach-the-topic lesson.
export async function generateMathLesson(
  text: string,
  language: "en" | "sv"
): Promise<MathLesson> {
  const result = await generateJson<MathLesson>(
    LESSON_SYSTEM_PROMPT,
    buildLessonPrompt(text, language)
  );

  const steps = (result.steps ?? [])
    .map((step, i) => ({
      id: step.id || `step-${i + 1}`,
      title: step.title?.trim() ?? "",
      explanation: step.explanation?.trim() ?? "",
      example: step.example?.trim() ?? "",
      tip: step.tip?.trim() ?? "",
    }))
    .filter((step) => step.title && step.explanation);

  return {
    topic: result.topic?.trim() || "Mathematics",
    steps,
  };
}

const LESSON_HELP_SYSTEM_PROMPT = `You are a supportive math tutor helping with one lesson step.

Given the document context and the current step, respond to the student's request:
- deeper: explain the same idea more slowly with a simpler analogy and a second tiny example.
- quiz: ask one short check-understanding question about this step only (no full answer in the question). Include a short hint.

Keep responses concise and clear. Use plain math text notation.`;

function buildLessonHelpPrompt(input: {
  documentText: string;
  step: LessonStep;
  action: "deeper" | "quiz";
  language: "en" | "sv";
}): string {
  const languageRule =
    input.language === "sv" ? "Respond in Swedish." : "Respond in English.";

  return `${languageRule}

Student request: ${input.action === "deeper" ? "explain this step more deeply / more simply" : "quiz me on this step"}

CURRENT STEP:
Title: ${input.step.title}
Explanation: ${input.step.explanation}
Example: ${input.step.example}
Tip: ${input.step.tip}

DOCUMENT CONTEXT (may be truncated):
${input.documentText.slice(0, 8000)}

Respond with JSON:
{
  "content": "main tutor reply",
  "quizQuestion": "only if action is quiz",
  "quizHint": "only if action is quiz"
}`;
}

export async function helpWithLessonStep(input: {
  documentText: string;
  step: LessonStep;
  action: "deeper" | "quiz";
  language: "en" | "sv";
}): Promise<LessonHelpResult> {
  const result = await generateJson<LessonHelpResult>(
    LESSON_HELP_SYSTEM_PROMPT,
    buildLessonHelpPrompt(input)
  );

  return {
    content: result.content?.trim() ?? "",
    quizQuestion: result.quizQuestion?.trim() || undefined,
    quizHint: result.quizHint?.trim() || undefined,
  };
}

export { formatAiError };
