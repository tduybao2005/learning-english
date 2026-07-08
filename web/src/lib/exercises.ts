import { db } from "@/lib/db";
import type { QuestionKind } from "@/lib/grading/match";

export interface OrderedQuestion {
  id: string;
  number: number;
  prompt: string;
  options: unknown;
  kind: QuestionKind;
  isOpenEnded: boolean;
  /** Normalized answer variants — SERVER-SIDE ONLY (e.g. computing the
   * error-correction underline span). Never forward these to the client. */
  variants: { normalized: string }[];
}

/**
 * Returns every question in `exerciseId`, in true pedagogical order.
 *
 * `Question.number` is unique only *within its Section*
 * (`@@unique([sectionId, number])`) — despite the schema comment calling it
 * a "global number within the exercise", that describes the
 * answer-key-matching convention (Task 4's parser assigns it from each
 * item's own marker digit: `A1.` -> 1, `B1.` -> 1, ...), not a cross-section
 * ordinal. Many real lessons restart numbering at 1 in every section
 * (confirmed: `phase_1_foundation/lesson_08_adjectives` is
 * A1..A12, B1..B10, C1..C8, D1..D5, E1..E5 — `max(number)` across the whole
 * exercise is 12, never reaching the true total of 40). `number` must never
 * be used to sort or index across sections, or to detect "the last
 * question in the exercise" — only for matching against the answer key /
 * display purposes *within* its own section.
 *
 * The one true global order is: `Section.orderIndex` ascending, then
 * `Question.number` ascending *within* that section — which is exactly
 * what this query produces via Prisma's `orderBy`, with no re-sort
 * afterward. Both the RSC exercise page (question order shown to the
 * learner) and the answers route (position / "is this the last question"
 * logic) call this single function so the two can never disagree.
 */
export async function getOrderedQuestions(exerciseId: string): Promise<OrderedQuestion[]> {
  const sections = await db.section.findMany({
    where: { exerciseId },
    orderBy: { orderIndex: "asc" },
    select: {
      kind: true,
      questions: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          prompt: true,
          options: true,
          isOpenEnded: true,
          variants: { select: { normalized: true } },
        },
      },
    },
  });

  return sections.flatMap((section) =>
    section.questions.map((q) => ({ ...q, kind: section.kind as QuestionKind })),
  );
}
