import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { matchAnswer, type QuestionKind } from "@/lib/grading/match";

const bodySchema = z.object({
  questionId: z.string().min(1),
  answerText: z.string(),
});

/**
 * Stateless answer check for a listening set's practice questions.
 *
 * Deliberately does NOT create an ExerciseAttempt/AttemptAnswer row: the
 * schema's `ExerciseAttempt.exerciseId` is a required FK with no equivalent
 * slot for `ListeningSet` (only `Section`/`Question` have a nullable
 * `listeningSetId`), so persisted, retry-tracked attempts (the Task 9
 * exercise flow, with lesson-unlock side effects) don't extend to listening
 * sets without a schema migration — out of scope for this task. Completion
 * ("all questions answered correctly, so the transcript unlocks") is tracked
 * client-side only in `ListeningRunner`. This route's one job, matching the
 * "answer keys never reach the client" constraint everywhere else in the
 * app, is to run `matchAnswer` against the server-side `AnswerVariant` rows
 * and hand back only the fields needed to render feedback.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  const rawBody = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const { questionId, answerText } = parsed.data;

  const listeningSet = await db.listeningSet.findUnique({ where: { slug } });
  if (!listeningSet) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { section: true, variants: true },
  });
  if (!question || question.section.listeningSetId !== listeningSet.id) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const matchResult = matchAnswer(answerText, {
    kind: question.section.kind as QuestionKind,
    isOpenEnded: question.isOpenEnded,
    variants: question.variants.map((v) => ({ normalized: v.normalized })),
  });

  return NextResponse.json({
    correct: matchResult.correct,
    matchType: matchResult.correct ? matchResult.matchType : undefined,
    keyNote: matchResult.correct ? question.keyNote : undefined,
    correctAnswer: matchResult.correct ? question.answerRaw : undefined,
  });
}
