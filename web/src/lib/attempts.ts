import { db } from "@/lib/db";

/**
 * Returns the learner's open (not yet completed) attempt on `exerciseId`,
 * creating one at question 1 if none exists. Shared by the RSC exercise page
 * (which needs an attempt to resume on first load) and the
 * `POST /api/exercises/[id]/attempts` route (non-redo path) so the two never
 * drift on what "resume" means.
 */
export async function getOrCreateOpenAttempt(userId: string, exerciseId: string) {
  const open = await db.exerciseAttempt.findFirst({
    where: { userId, exerciseId, completedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (open) return open;

  return db.exerciseAttempt.create({ data: { userId, exerciseId } });
}
