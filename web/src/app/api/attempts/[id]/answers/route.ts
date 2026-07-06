import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { matchAnswer, type QuestionKind } from "@/lib/grading/match";
import { explainer } from "@/lib/ai/grader";
import { getNextLesson } from "@/lib/progress";
import { getOrderedQuestions } from "@/lib/exercises";

const bodySchema = z.object({
  questionId: z.string().min(1),
  answerText: z.string(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const { id: attemptId } = await params;

  const rawBody = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const { questionId, answerText } = parsed.data;

  const attempt = await db.exerciseAttempt.findUnique({
    where: { id: attemptId },
    include: { exercise: { include: { lesson: true } } },
  });
  if (!attempt || attempt.userId !== user.id) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  if (attempt.completedAt) {
    return NextResponse.json({ ok: false, reason: "already_completed" }, { status: 400 });
  }

  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { section: true, variants: true },
  });
  if (!question || question.section.exerciseId !== attempt.exerciseId) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const matchResult = matchAnswer(answerText, {
    kind: question.section.kind as QuestionKind,
    isOpenEnded: question.isOpenEnded,
    variants: question.variants.map((v) => ({ normalized: v.normalized })),
  });

  const existingAnswer = await db.attemptAnswer.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
  });
  const priorWrongAnswers = Array.isArray(existingAnswer?.wrongAnswers)
    ? (existingAnswer.wrongAnswers as string[])
    : [];

  let explanation: string | null = existingAnswer?.explanation ?? null;
  let wrongAnswers = priorWrongAnswers;

  if (!matchResult.correct) {
    wrongAnswers = [...priorWrongAnswers, answerText];
    explanation = await explainer.explain({
      questionPrompt: question.prompt,
      questionKind: question.section.kind,
      userAnswer: answerText,
      correctAnswers: question.variants.map((v) => v.text),
      keyNote: question.keyNote,
      lessonSlug: attempt.exercise.lesson.slug,
    });
  }

  // `Question.number` is only unique *within its section* — it restarts at
  // 1 in every section for most real lessons (e.g.
  // phase_1_foundation/lesson_08_adjectives: A1..A12, B1..B10, ...), so it
  // is NOT a cross-section ordinal and must never be compared against a
  // whole-exercise count. `getOrderedQuestions` gives the one true global
  // order (Section.orderIndex asc, then Question.number asc within each
  // section); this question's 1-based position in that list is the real
  // "how far through the exercise is this" signal.
  const orderedQuestions = await getOrderedQuestions(attempt.exerciseId);
  const totalQuestions = orderedQuestions.length;
  const positionIndex = orderedQuestions.findIndex((q) => q.id === questionId);
  if (positionIndex === -1) {
    // Already validated above that this question belongs to the attempt's
    // exercise, so this would mean `getOrderedQuestions` and the
    // section/question relations have gone out of sync — a real bug, not
    // a user-triggerable state. Fail loudly rather than silently miscount.
    throw new Error(`Question ${questionId} not found in ordered list for exercise ${attempt.exerciseId}`);
  }
  const globalPosition = positionIndex + 1; // 1-based
  const isLastQuestion = globalPosition === totalQuestions;
  const isCompleting = matchResult.correct && isLastQuestion;

  // Read-only lookup, safe to do outside the write transaction below — the
  // curriculum graph (Lesson/Phase) is static, not mutated concurrently.
  const nextLesson = isCompleting ? await getNextLesson(attempt.exercise.lessonId) : null;

  const attemptAnswerData = {
    answerText,
    isCorrect: matchResult.correct,
    matchType: matchResult.correct ? matchResult.matchType : null,
    wrongAnswers: (wrongAnswers.length ? wrongAnswers : undefined) as Prisma.InputJsonValue | undefined,
    explanation,
  };

  await db.$transaction(async (tx) => {
    await tx.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: { attemptId, questionId, tries: 1, ...attemptAnswerData },
      update: { tries: (existingAnswer?.tries ?? 0) + 1, ...attemptAnswerData },
    });

    if (matchResult.correct) {
      await tx.exerciseAttempt.update({
        where: { id: attemptId },
        data: {
          currentQuestionNumber: Math.max(attempt.currentQuestionNumber, globalPosition + 1),
          completedAt: isCompleting ? new Date() : undefined,
        },
      });
    }

    // CRITICAL: both halves of lesson unlocking happen together in this same
    // transaction. Writing only the COMPLETED row (without also UNLOCKED-ing
    // the next lesson) would strand the learner on a completed lesson with
    // no way to progress — see Task 7's reviewer note.
    if (isCompleting) {
      const now = new Date();
      await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId: user.id, lessonId: attempt.exercise.lessonId } },
        create: { userId: user.id, lessonId: attempt.exercise.lessonId, status: "COMPLETED", completedAt: now },
        update: { status: "COMPLETED", completedAt: now },
      });

      if (nextLesson) {
        await tx.lessonProgress.upsert({
          where: { userId_lessonId: { userId: user.id, lessonId: nextLesson.id } },
          // Only creates the UNLOCKED row if none exists yet — never downgrades
          // a lesson the learner has already completed/skipped.
          create: { userId: user.id, lessonId: nextLesson.id, status: "UNLOCKED" },
          update: {},
        });
      }
    }
  });

  return NextResponse.json({
    correct: matchResult.correct,
    matchType: matchResult.correct ? matchResult.matchType : undefined,
    keyNote: question.keyNote,
    correctAnswer: matchResult.correct ? question.answerRaw : undefined,
    explanation,
    completedLesson: isCompleting ? { nextLessonSlug: nextLesson?.slug ?? null } : undefined,
  });
}
