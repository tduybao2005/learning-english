import { db } from "@/lib/db";
import type { QuestionKind } from "@/lib/grading/match";

export interface OrderedPlacementQuestion {
  id: string;
  number: number;
  prompt: string;
  options: unknown;
  imageUrl: string | null;
  kind: QuestionKind;
  isOpenEnded: boolean;
}

export interface PlacementSectionWithQuestions {
  label: string;
  title: string;
  instructions: string | null;
  kind: QuestionKind;
  questions: OrderedPlacementQuestion[];
}

/**
 * Same true-pedagogical-order convention as `lib/exercises.ts`'s
 * `getOrderedQuestions` / `lib/listening.ts`'s `getOrderedListeningQuestions`
 * (Section.orderIndex asc, then Question.number asc within each section) —
 * just scoped to `placementTestId` instead, and grouped by section (rather
 * than flattened) since the placement wizard shows a whole section's
 * instructions once above its batch of questions. Never selects
 * `answerRaw` or `variants` — the answer key must never reach the client.
 */
export async function getOrderedPlacementSections(placementTestId: string): Promise<PlacementSectionWithQuestions[]> {
  const sections = await db.section.findMany({
    where: { placementTestId },
    orderBy: { orderIndex: "asc" },
    select: {
      label: true,
      title: true,
      instructions: true,
      kind: true,
      questions: {
        orderBy: { number: "asc" },
        select: { id: true, number: true, prompt: true, options: true, imageUrl: true, isOpenEnded: true },
      },
    },
  });

  return sections.map((section) => ({
    label: section.label,
    title: section.title,
    instructions: section.instructions,
    kind: section.kind as QuestionKind,
    questions: section.questions.map((q) => ({ ...q, kind: section.kind as QuestionKind })),
  }));
}
