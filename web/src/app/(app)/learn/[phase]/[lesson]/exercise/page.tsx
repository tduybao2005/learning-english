import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getLessonStates, getNextLesson } from "@/lib/progress";
import { getOrCreateOpenAttempt } from "@/lib/attempts";
import { getOrderedQuestions } from "@/lib/exercises";
import { ExerciseRunner, type NextLessonInfo } from "@/components/ExerciseRunner";
import type { SafeQuestion } from "@/components/runner/QuestionCard";
import { LessonTabs } from "@/components/LessonTabs";

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
  const states = await getLessonStates(user.id);
  const state = states.get(lesson.id) ?? "LOCKED";
  if (state === "LOCKED") redirect("/dashboard");

  const base = `/learn/${phaseSlug}/${lessonSlug}`;

  if (!lesson.exercise) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <LessonTabs
          phaseTitle={lesson.phase.title}
          lessonTitle={lesson.title}
          basePath={base}
          active="exercise"
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
  }));

  const attempt = await getOrCreateOpenAttempt(user.id, lesson.exercise.id);

  const nextLessonRaw = await getNextLesson(lesson.id);
  let nextLesson: NextLessonInfo | null = null;
  if (nextLessonRaw) {
    const nextPhase = await db.phase.findUnique({ where: { id: nextLessonRaw.phaseId } });
    if (nextPhase) {
      nextLesson = { slug: nextLessonRaw.slug, phaseSlug: nextPhase.slug, title: nextLessonRaw.title };
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <LessonTabs
        phaseTitle={lesson.phase.title}
        lessonTitle={lesson.title}
        basePath={base}
        active="exercise"
      />
      <ExerciseRunner
        exerciseId={lesson.exercise.id}
        attemptId={attempt.id}
        initialQuestionNumber={attempt.currentQuestionNumber}
        questions={questions}
        nextLesson={nextLesson}
        backHref={base}
      />
    </div>
  );
}
