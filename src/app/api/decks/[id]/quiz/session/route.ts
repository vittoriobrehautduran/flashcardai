import { NextResponse } from "next/server";
import {
  getActiveQuizSession,
  startQuizSession,
  updateQuizSession,
  completeQuizSession,
  abandonQuizSession,
} from "@/lib/progress";
import type { QuizQuestion } from "@/lib/quiz";
import { requireApiUser, requireOwnedDeck } from "@/lib/api-route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const owned = await requireOwnedDeck(id, auth.user.id);
  if ("response" in owned) return owned.response;

  const modeParam = new URL(request.url).searchParams.get("mode");
  const mode =
    modeParam === "written" ? "written" : modeParam === "choice" ? "choice" : undefined;

  const active = await getActiveQuizSession(id, mode);
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
      mode: active.mode,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id: deckId } = await params;
  const owned = await requireOwnedDeck(deckId, auth.user.id);
  if ("response" in owned) return owned.response;

  const body = await request.json();
  const questions = body.questions as QuizQuestion[] | undefined;
  const questionCount = body.questionCount as number | undefined;
  const mode = body.mode === "written" ? "written" : "choice";

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "questions are required" }, { status: 400 });
  }

  const session = await startQuizSession(
    deckId,
    questions,
    questionCount ?? questions.length,
    mode
  );

  return NextResponse.json({
    session: {
      id: session.id,
      questions: session.questions,
      questionCount: questionCount ?? questions.length,
      currentIndex: session.currentIndex,
      score: session.score,
      wrongCardIds: session.wrongCardIds,
      mode: session.mode,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id: deckId } = await params;
  const owned = await requireOwnedDeck(deckId, auth.user.id);
  if ("response" in owned) return owned.response;

  const body = await request.json();
  const sessionId = body.sessionId as string | undefined;
  const currentIndex = body.currentIndex as number | undefined;
  const score = body.score as number | undefined;
  const complete = body.complete as boolean | undefined;
  const wrongCardIds = body.wrongCardIds as string[] | undefined;

  if (!sessionId || currentIndex === undefined || score === undefined) {
    return NextResponse.json(
      { error: "sessionId, currentIndex, score required" },
      { status: 400 }
    );
  }

  if (complete) {
    await completeQuizSession(sessionId, score);
    if (wrongCardIds) {
      await updateQuizSession(sessionId, currentIndex, score, wrongCardIds);
    }
  } else {
    await updateQuizSession(sessionId, currentIndex, score, wrongCardIds);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id: deckId } = await params;
  const owned = await requireOwnedDeck(deckId, auth.user.id);
  if ("response" in owned) return owned.response;

  const body = await request.json().catch(() => ({}));
  const sessionId = body.sessionId as string | undefined;

  if (sessionId) {
    await abandonQuizSession(sessionId);
  } else {
    const active = await getActiveQuizSession(deckId);
    if (active) await abandonQuizSession(active.id);
  }

  return NextResponse.json({ ok: true });
}
