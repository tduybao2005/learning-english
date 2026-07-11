import { db } from "@/lib/db";
import type { QuestionKind } from "@/lib/grading/match";

export interface OrderedListeningQuestion {
  id: string;
  number: number;
  prompt: string;
  options: unknown;
  imageUrl: string | null;
  kind: QuestionKind;
  isOpenEnded: boolean;
}

export interface ListeningSectionWithQuestions {
  label: string;
  title: string;
  instructions: string | null;
  kind: QuestionKind;
  audioUrl: string | null;
  questions: OrderedListeningQuestion[];
}

/**
 * Same true-pedagogical-order convention as `lib/exercises.ts`'s
 * `getOrderedQuestions` (Section.orderIndex asc, then Question.number asc
 * within each section) — just scoped to `listeningSetId` instead of
 * `exerciseId`, since `Section` has exactly one of the two FKs set. Grouped
 * by section (with each section's label/title/instructions) rather than
 * flattened — needed by the placement wizard so a multi-part listening test
 * (IELTS 4 sections / TOEIC 4 parts) can render its section headers,
 * mirroring `lib/placement.ts`'s `getOrderedPlacementSections`, and by the
 * sectioned Luyện Nghe runner.
 */
export async function getOrderedListeningSections(listeningSetId: string): Promise<ListeningSectionWithQuestions[]> {
  const sections = await db.section.findMany({
    where: { listeningSetId },
    orderBy: { orderIndex: "asc" },
    select: {
      label: true,
      title: true,
      instructions: true,
      kind: true,
      audioUrl: true,
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
    audioUrl: section.audioUrl,
    questions: section.questions.map((q) => ({ ...q, kind: section.kind as QuestionKind })),
  }));
}
