import type { Lesson, LessonStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

/** A Prisma client usable for a query — either the top-level `db` or an
 * interactive-transaction `tx` handle. Lets `assignStartPoint` below be
 * composed into a caller's own transaction (e.g. alongside creating a
 * `PlacementAttempt` row) instead of always opening its own. */
type DbOrTx = typeof db | Prisma.TransactionClient;

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
export async function getLessonStates(
  userId: string | null,
): Promise<Map<string, LessonState>> {
  const lessons = await getLessonsInGlobalOrder();
  // Khách chưa đăng nhập không có bản ghi tiến độ nào; truy vấn với userId
  // rỗng sẽ trả về toàn bộ bảng nên phải chặn ở đây.
  const progressRows = userId
    ? await db.lessonProgress.findMany({ where: { userId } })
    : [];
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

/** The first lesson (lowest `orderIndex`) of the phase identified by `phaseSlug`,
 * or `null` if no such phase exists (e.g. curriculum not seeded yet). Used by
 * the placement-test completion flow to turn `startLessonFor(band).phaseSlug`
 * into an actual lesson to unlock. */
export async function getFirstLessonOfPhase(phaseSlug: string): Promise<Lesson | null> {
  const phase = await db.phase.findUnique({ where: { slug: phaseSlug } });
  if (!phase) return null;
  return db.lesson.findFirst({ where: { phaseId: phase.id }, orderBy: { orderIndex: "asc" } });
}

/**
 * Applies a placement-test result (or a "start from scratch" reset, which
 * just calls this with the very first lesson overall): every lesson
 * strictly before `startLessonId` in global order becomes SKIPPED, and
 * `startLessonId` itself becomes UNLOCKED.
 *
 * Two correctness guards:
 *  - A lesson the user has already COMPLETED is never downgraded to
 *    SKIPPED (and an already-COMPLETED start lesson is left alone rather
 *    than being redundantly "re-unlocked").
 *  - Idempotent / re-runnable: always clears this user's existing SKIPPED
 *    AND UNLOCKED rows first, so re-taking the placement test (or resetting
 *    to phase 1) never leaves stale SKIPPED/UNLOCKED rows from a previous
 *    run lingering outside the new range — e.g. a first placement assigning
 *    phase_3 skips
 *    phase_1/2's lessons; if the user later resets to "start from
 *    scratch" (startLessonId = the very first lesson, so `beforeLessons`
 *    is empty), those old phase_1/2 SKIPPED rows must be cleared, not left
 *    behind, or the lesson map would still show them as skipped forever.
 *
 * Takes an explicit Prisma client (`db` or a `tx` handle) so callers that
 * need this to be atomic with another write (e.g. creating the
 * `PlacementAttempt` row) can pass their own transaction's `tx`.
 */
export async function assignStartPoint(
  client: DbOrTx,
  userId: string,
  startLessonId: string,
): Promise<void> {
  const lessons = await client.lesson.findMany({
    orderBy: [{ phase: { orderIndex: "asc" } }, { orderIndex: "asc" }],
  });
  const startIndex = lessons.findIndex((l) => l.id === startLessonId);
  if (startIndex === -1) {
    throw new Error(`assignStartPoint: lesson ${startLessonId} not found in global lesson order`);
  }
  const beforeLessons = lessons.slice(0, startIndex);
  const startLesson = lessons[startIndex];

  // Xoá mọi row do một lần xếp-điểm trước để lại (SKIPPED + UNLOCKED) để
  // điểm-bắt-đầu mới là nguồn chân lý duy nhất: nếu chỉ xoá SKIPPED, một row
  // UNLOCKED cũ nằm SAU điểm bắt đầu mới (vd đã mở phase_2 rồi xếp lại về
  // phase_1) sẽ còn sót và mở khoá nhầm. COMPLETED là tiến độ học thật —
  // không bao giờ xoá; các nhánh upsert bên dưới đã tôn trọng nó.
  await client.lessonProgress.deleteMany({
    where: { userId, status: { in: ["SKIPPED", "UNLOCKED"] } },
  });

  const existingRows = await client.lessonProgress.findMany({
    where: { userId, lessonId: { in: [...beforeLessons.map((l) => l.id), startLesson.id] } },
  });
  const statusByLessonId = new Map(existingRows.map((r) => [r.lessonId, r.status]));

  for (const lesson of beforeLessons) {
    if (statusByLessonId.get(lesson.id) === "COMPLETED") continue;
    await client.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
      create: { userId, lessonId: lesson.id, status: "SKIPPED" },
      update: { status: "SKIPPED" },
    });
  }

  if (statusByLessonId.get(startLesson.id) !== "COMPLETED") {
    await client.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: startLesson.id } },
      create: { userId, lessonId: startLesson.id, status: "UNLOCKED" },
      update: { status: "UNLOCKED" },
    });
  }
}
