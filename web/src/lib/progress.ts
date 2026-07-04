import type { Lesson, LessonStatus } from "@prisma/client";

import { db } from "@/lib/db";

/** LessonStatus plus the implicit "no row" state ("LOCKED" = no LessonProgress row). */
export type LessonState = "LOCKED" | LessonStatus;

/** All lessons ordered globally: phase.orderIndex asc, then lesson.orderIndex asc. */
async function getLessonsInGlobalOrder(): Promise<Lesson[]> {
  return db.lesson.findMany({
    orderBy: [{ phase: { orderIndex: "asc" } }, { orderIndex: "asc" }],
  });
}

/**
 * Computes the lock state of every lesson for a user.
 *
 * A lesson's state is its explicit `LessonProgress` row's status if one exists.
 * Absent a row, a lesson is LOCKED — except the globally-first lesson (lowest
 * orderIndex in the lowest-orderIndex phase), which bootstraps as UNLOCKED for
 * a brand new user. Subsequent unlocks are expected to be written as explicit
 * UNLOCKED rows by the lesson-completion flow (Task 9), not computed here.
 */
export async function getLessonStates(userId: string): Promise<Map<string, LessonState>> {
  const lessons = await getLessonsInGlobalOrder();
  const progressRows = await db.lessonProgress.findMany({ where: { userId } });
  const statusByLessonId = new Map(progressRows.map((row) => [row.lessonId, row.status]));

  const states = new Map<string, LessonState>();
  lessons.forEach((lesson, index) => {
    const status = statusByLessonId.get(lesson.id);
    if (status) {
      states.set(lesson.id, status);
    } else if (index === 0) {
      states.set(lesson.id, "UNLOCKED");
    } else {
      states.set(lesson.id, "LOCKED");
    }
  });

  return states;
}

/**
 * Returns the lesson that follows `lessonId` in the curriculum: the next
 * orderIndex within the same phase, else the first lesson of the next phase,
 * else `null` if this is the last lesson overall (or `lessonId` doesn't exist).
 */
export async function getNextLesson(lessonId: string): Promise<Lesson | null> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return null;

  const nextInPhase = await db.lesson.findFirst({
    where: { phaseId: lesson.phaseId, orderIndex: { gt: lesson.orderIndex } },
    orderBy: { orderIndex: "asc" },
  });
  if (nextInPhase) return nextInPhase;

  const currentPhase = await db.phase.findUnique({ where: { id: lesson.phaseId } });
  if (!currentPhase) return null;

  const nextPhase = await db.phase.findFirst({
    where: { orderIndex: { gt: currentPhase.orderIndex } },
    orderBy: { orderIndex: "asc" },
  });
  if (!nextPhase) return null;

  return db.lesson.findFirst({
    where: { phaseId: nextPhase.id },
    orderBy: { orderIndex: "asc" },
  });
}
