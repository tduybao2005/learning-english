import { db } from "@/lib/db";

/** Leitner boxes run 0..5; box >= LEARNED_BOX_THRESHOLD counts as "learned". */
export const LEITNER_MAX_BOX = 5;
export const LEARNED_BOX_THRESHOLD = 3;

/**
 * Pure Leitner box transition: a correct self-report advances the box by 1
 * (capped at `LEITNER_MAX_BOX`, never overflowing past 5); a wrong self-report
 * resets the box all the way to 0 (never negative).
 */
export function nextBox(currentBox: number, correct: boolean): number {
  if (correct) return Math.min(currentBox + 1, LEITNER_MAX_BOX);
  return 0;
}

export interface VocabStats {
  learned: number;
  total: number;
}

/**
 * `total` = every VocabWord belonging to `lessonId` (regardless of whether the
 * user has reviewed it yet). `learned` = the subset of those words for which
 * `userId` has a VocabProgress row with `box >= LEARNED_BOX_THRESHOLD`. Words
 * with no VocabProgress row at all (never reviewed) are simply not learned —
 * there is nothing to count.
 */
export async function getVocabStats(userId: string, lessonId: string): Promise<VocabStats> {
  const [total, learned] = await Promise.all([
    db.vocabWord.count({ where: { lessonId } }),
    db.vocabProgress.count({
      where: { userId, box: { gte: LEARNED_BOX_THRESHOLD }, word: { lessonId } },
    }),
  ]);
  return { learned, total };
}

export interface ReviewResult {
  wordId: string;
  correct: boolean;
}

/**
 * Batch-applies a flashcard session's self-reported Leitner results for
 * `userId`. For each result, reads the word's current box (0 if no
 * VocabProgress row exists yet — a first-time review) and writes the next
 * box via `nextBox`, stamping `lastReviewedAt`. All writes happen in a single
 * transaction so a session's results are applied atomically.
 */
export async function applyReviewResults(userId: string, results: ReviewResult[]): Promise<void> {
  if (results.length === 0) return;

  const wordIds = results.map((r) => r.wordId);
  const existing = await db.vocabProgress.findMany({
    where: { userId, wordId: { in: wordIds } },
  });
  const existingBoxByWordId = new Map(existing.map((row) => [row.wordId, row.box]));

  const now = new Date();
  await db.$transaction(
    results.map((result) => {
      const currentBox = existingBoxByWordId.get(result.wordId) ?? 0;
      const box = nextBox(currentBox, result.correct);
      return db.vocabProgress.upsert({
        where: { userId_wordId: { userId, wordId: result.wordId } },
        create: { userId, wordId: result.wordId, box, lastReviewedAt: now },
        update: { box, lastReviewedAt: now },
      });
    }),
  );
}
