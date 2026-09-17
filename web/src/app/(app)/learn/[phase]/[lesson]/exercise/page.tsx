import NextLink from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getNextLesson } from "@/lib/progress";
import { getOrCreateOpenAttempt } from "@/lib/attempts";
import { getOrderedQuestions } from "@/lib/exercises";
import { ExerciseRunner, type NextLessonInfo } from "@/components/ExerciseRunner";
import type { SafeQuestion } from "@/components/runner/QuestionCard";
import { LessonTabs } from "@/components/LessonTabs";
import { findErrorSpan, stripErrorScaffold } from "@/lib/grading/error-span";

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ phase: string; lesson: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { phase: phaseSlug, lesson: lessonSlug } = await params;

  const lesson = await db.lesson.findFirst({
    where: { slug: lessonSlug, phase: { slug: phaseSlug } },
    include: {
      phase: true,
      exercise: { select: { id: true } },
    },
  });

  if (!lesson) notFound();

  // Guard: a locked lesson's URL is not viewable — bounce back to the dashboard.

  const base = `/learn/${phaseSlug}/${lessonSlug}`;

  if (!lesson.exercise) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <LessonTabs
          phaseTitle={lesson.phase.title}
          lessonTitle={lesson.title}
          basePath={base}
          active="exercise"
          linkComponent={NextLink}
        />
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          Bài học này chưa có bài tập.
        </p>
      </div>
    );
  }

  // `getOrderedQuestions` already returns the true pedagogical order
  // (Section.orderIndex asc, then Question.number asc within each section —
  // see its docstring for why raw `number` alone must never be re-sorted
  // on: it restarts per section for most real lessons). No further sort.
  const ordered = await getOrderedQuestions(lesson.exercise.id);
  const questions: SafeQuestion[] = ordered.map((q) => ({
    id: q.id,
    number: q.number,
    prompt: q.prompt,
    options: q.options as { label: string; text: string }[] | null,
    kind: q.kind,
    isOpenEnded: q.isOpenEnded,
    // Variants stay server-side: only the computed char offsets ship to the
    // client so the runner can wavy-underline the suspect words.
    errorSpan:
      q.kind === "ERROR_CORRECTION"
        ? findErrorSpan(stripErrorScaffold(q.prompt), q.variants[0]?.normalized ?? "")
        : undefined,
  }));

  const attempt = await getOrCreateOpenAttempt(user.id, lesson.exercise.id);

  // Hydrate the read-only review history from the server so "← Câu trước"
  // works immediately when a learner resumes a partly-done attempt. Only the
  // questions BEFORE the resume point that were answered correctly are shown;
  // their answer text comes from AttemptAnswer, the correct answer / keyNote
  // from the Question rows (never the client). Without this, `past` starts
  // empty on every mount and the back button is dead until one more answer.
  const answeredRows = await db.attemptAnswer.findMany({
    where: { attemptId: attempt.id, isCorrect: true },
    select: { questionId: true, answerText: true },
  });
  const answeredByQid = new Map(answeredRows.map((a) => [a.questionId, a.answerText]));
  const answerMeta = answeredByQid.size
    ? await db.question.findMany({
        where: { id: { in: [...answeredByQid.keys()] } },
        select: { id: true, answerRaw: true, keyNote: true },
      })
    : [];
  const metaByQid = new Map(answerMeta.map((q) => [q.id, q]));
  const currentIndex = attempt.currentQuestionNumber - 1;
  const initialPast = ordered
    .map((q, index) => ({ q, index }))
    .filter(({ q, index }) => index < currentIndex && answeredByQid.has(q.id))
    .map(({ q, index }) => ({
      index,
      answerText: answeredByQid.get(q.id) ?? "",
      correctAnswer: metaByQid.get(q.id)?.answerRaw ?? null,
      keyNote: metaByQid.get(q.id)?.keyNote ?? null,
    }));

  const nextLessonRaw = await getNextLesson(lesson.id);
  let nextLesson: NextLessonInfo | null = null;
  if (nextLessonRaw) {
    const nextPhase = await db.phase.findUnique({ where: { id: nextLessonRaw.phaseId } });
    if (nextPhase) {
      nextLesson = { slug: nextLessonRaw.slug, phaseSlug: nextPhase.slug, title: nextLessonRaw.title };
    }
  }

  return (
    // Focus mode at every width. Desktop already overlaid the app chrome
    // (lg:fixed inset-0); below lg the page used to ALSO render LessonTabs, so a
    // phone got: back link, tab row, a three-line shouting title, and only then
    // the runner's own ✕ stranded in the middle. The runner names the lesson in
    // its header instead — nothing here but the runner.
    <div className="mx-auto max-w-3xl px-4 py-6 lg:fixed lg:inset-0 lg:z-50 lg:m-0 lg:max-w-none lg:overflow-y-auto lg:bg-background lg:px-0 lg:py-0">
      <div className="lg:mx-auto lg:max-w-5xl lg:px-8 lg:py-10">
        <ExerciseRunner
          exerciseId={lesson.exercise.id}
          attemptId={attempt.id}
          initialQuestionNumber={attempt.currentQuestionNumber}
          questions={questions}
          nextLesson={nextLesson}
          backHref={base}
          lessonTitle={lesson.title}
          initialPast={initialPast}
          linkComponent={NextLink}
        />
      </div>
    </div>
  );
}
