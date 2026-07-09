import type { GoalType, PlacementTest } from "@prisma/client";

/**
 * Which `ListeningSet` id a placement attempt should use, based on the
 * learner's goal. Falls back to the IELTS set for TOEIC learners if the
 * TOEIC set hasn't been seeded yet — degrade gracefully rather than break
 * the whole placement flow over one missing seed.
 */
export function placementListeningSetId(
  test: Pick<PlacementTest, "listeningSetId" | "toeicListeningSetId">,
  goalType: GoalType | null,
): string | null {
  return goalType === "TOEIC" ? (test.toeicListeningSetId ?? test.listeningSetId) : test.listeningSetId;
}
