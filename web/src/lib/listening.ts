import { db } from "@/lib/db";
import type { QuestionKind } from "@/lib/grading/match";

export interface OrderedListeningQuestion {
  id: string;
  number: number;
  prompt: string;
  options: unknown;
  kind: QuestionKind;
  isOpenEnded: boolean;
}

/**
 * Same true-pedagogical-order convention as `lib/exercises.ts`'s
 * `getOrderedQuestions` (Section.orderIndex asc, then Question.number asc
 * within each section) — just scoped to `listeningSetId` instead of
 * `exerciseId`, since `Section` has exactly one of the two FKs set.
 */
export async function getOrderedListeningQuestions(listeningSetId: string): Promise<OrderedListeningQuestion[]> {
  const sections = await db.section.findMany({
    where: { listeningSetId },
    orderBy: { orderIndex: "asc" },
    select: {
      kind: true,
      questions: {
        orderBy: { number: "asc" },
        select: { id: true, number: true, prompt: true, options: true, isOpenEnded: true },
      },
    },
  });

  return sections.flatMap((section) =>
    section.questions.map((q) => ({ ...q, kind: section.kind as QuestionKind })),
  );
}
