import { NextResponse } from "next/server";
import { getDeck } from "@/lib/decks";
import {
  getActiveQuizSession,
  startQuizSession,
  updateQuizSession,
  completeQuizSession,
  abandonQuizSession,
} from "@/lib/progress";
import type { QuizQuestion } from "@/lib/quiz";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deck = getDeck(id);

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const active = getActiveQuizSession(id);
  if (!active) {
    return NextResponse.json({ session: null });
  }

  return NextResponse.json({
    session: {
      id: active.id,
      questions: active.questions,
      questionCount: active.questionCount,
      currentIndex: active.currentIndex,
      score: active.score,
      wrongCardIds: active.wrongCardIds,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deckId } = await params;
  const deck = getDeck(deckId);

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const body = await request.json();
  const questions = body.questions as QuizQuestion[] | undefined;
  const questionCount = body.questionCount as number | undefined;

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "questions are required" }, { status: 400 });
  }

  const session = startQuizSession(deckId, questions, questionCount ?? questions.length);

  return NextResponse.json({
    session: {
      id: session.id,
      questions: session.questions,
      questionCount: questionCount ?? questions.length,
      currentIndex: session.currentIndex,
      score: session.score,
      wrongCardIds: session.wrongCardIds,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deckId } = await params;
  const deck = getDeck(deckId);

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const body = await request.json();
  const sessionId = body.sessionId as string | undefined;
  const currentIndex = body.currentIndex as number | undefined;
  const score = body.score as number | undefined;
  const complete = body.complete as boolean | undefined;
  const wrongCardIds = body.wrongCardIds as string[] | undefined;

  if (!sessionId || currentIndex === undefined || score === undefined) {
    return NextResponse.json({ error: "sessionId, currentIndex, score required" }, { status: 400 });
  }

  if (complete) {
    completeQuizSession(sessionId, score);
    if (wrongCardIds) {
      updateQuizSession(sessionId, currentIndex, score, wrongCardIds);
    }
  } else {
    updateQuizSession(sessionId, currentIndex, score, wrongCardIds);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deckId } = await params;
  const deck = getDeck(deckId);

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = body.sessionId as string | undefined;

  if (sessionId) {
    abandonQuizSession(sessionId);
  } else {
    const active = getActiveQuizSession(deckId);
    if (active) abandonQuizSession(active.id);
  }

  return NextResponse.json({ ok: true });
}
