import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getLessonStates, getNextLesson } from "@/lib/progress";
import { getOrCreateOpenAttempt } from "@/lib/attempts";
import { getOrderedQuestions } from "@/lib/exercises";
import { ExerciseRunner, type NextLessonInfo } from "@/components/ExerciseRunner";
import type { SafeQuestion } from "@/components/runner/QuestionCard";
import { cn } from "@/lib/utils";

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
  const tabs = [
    { href: base, label: "Bài giảng", active: false },
    { href: `${base}/vocab`, label: "Từ vựng", active: false },
    { href: `${base}/exercise`, label: "Bài tập", active: true },
  ];

  if (!lesson.exercise) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <LessonTabs lessonTitle={lesson.title} phaseTitle={lesson.phase.title} tabs={tabs} />
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
      <LessonTabs lessonTitle={lesson.title} phaseTitle={lesson.phase.title} tabs={tabs} />
      <ExerciseRunner
        exerciseId={lesson.exercise.id}
        attemptId={attempt.id}
        initialQuestionNumber={attempt.currentQuestionNumber}
        questions={questions}
        nextLesson={nextLesson}
      />
    </div>
  );
}

function LessonTabs({
  lessonTitle,
  phaseTitle,
  tabs,
}: {
  lessonTitle: string;
  phaseTitle: string;
  tabs: { href: string; label: string; active: boolean }[];
}) {
  return (
    <>
      <Link
        href="/dashboard"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Quay lại lộ trình học
      </Link>

      <p className="text-sm font-medium text-primary">{phaseTitle}</p>
      <h1 className="mb-4 text-2xl font-bold">{lessonTitle}</h1>

      <div className="mb-6 flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              tab.active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </>
  );
}
