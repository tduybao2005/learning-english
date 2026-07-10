import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getOrderedListeningSections } from "@/lib/listening";
import { getOrderedPlacementSections } from "@/lib/placement";
import { placementListeningSetId } from "@/lib/placement-listening";
import { PlacementWizardConnected } from "@/components/PlacementWizardConnected";
import type { SafeQuestion } from "@/components/runner/QuestionCard";

export default async function PlacementTestPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const test = await db.placementTest.findUnique({ where: { slug: "default" } });
  if (!test) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-bold">Bài kiểm tra đầu vào chưa sẵn sàng</h1>
        <p className="text-sm text-muted-foreground">
          Vui lòng quay lại sau hoặc liên hệ quản trị viên.
        </p>
      </div>
    );
  }

  const listeningSetId = placementListeningSetId(test, user.goalType);
  const listeningSet = listeningSetId
    ? await db.listeningSet.findUnique({ where: { id: listeningSetId } })
    : null;

  const [listeningSectionsRaw, readingSectionsRaw] = await Promise.all([
    listeningSet ? getOrderedListeningSections(listeningSet.id) : Promise.resolve([]),
    getOrderedPlacementSections(test.id),
  ]);

  const listeningSections = listeningSectionsRaw.map((section) => ({
    label: section.label,
    title: section.title,
    instructions: section.instructions,
    questions: section.questions.map(
      (q): SafeQuestion => ({
        id: q.id,
        number: q.number,
        prompt: q.prompt,
        options: q.options as { label: string; text: string }[] | null,
        imageUrl: q.imageUrl,
        kind: q.kind,
        isOpenEnded: q.isOpenEnded,
      }),
    ),
  }));

  const readingSections = readingSectionsRaw.map((section) => ({
    label: section.label,
    title: section.title,
    instructions: section.instructions,
    questions: section.questions.map(
      (q): SafeQuestion => ({
        id: q.id,
        number: q.number,
        prompt: q.prompt,
        options: q.options as { label: string; text: string }[] | null,
        kind: q.kind,
        isOpenEnded: q.isOpenEnded,
      }),
    ),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:max-w-5xl">
      <PlacementWizardConnected
        listening={
          listeningSet
            ? {
                audioUrl: listeningSet.audioUrl,
                durationSec: listeningSet.durationSec,
                sections: listeningSections,
              }
            : null
        }
        readingMd={test.readingMd}
        readingSections={readingSections}
        writingPromptMd={test.writingPromptMd}
      />
    </div>
  );
}
