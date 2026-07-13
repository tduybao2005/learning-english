import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getOrderedListeningSections } from "@/lib/listening";
import { ListeningSetView } from "@/components/ListeningSetView";
import { ListeningBottomNav } from "@/components/ListeningBottomNav";
import type { SafeListeningSection } from "@/components/runner/section-runner";
import { LevelBadge } from "@/components/LevelBadge";

export default async function ListeningSetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { slug } = await params;

  const listeningSet = await db.listeningSet.findUnique({ where: { slug } });
  if (!listeningSet) notFound();

  // Prompts/options only — never `answerRaw`/`variants` (same "answer keys
  // never reach the client" rule as the lesson exercise RSC page).
  const sections = await getOrderedListeningSections(listeningSet.id);
  const safeSections: SafeListeningSection[] = sections.map((s) => ({
    label: s.label,
    title: s.title,
    instructions: s.instructions,
    audioUrl: s.audioUrl,
    questions: s.questions.map((q) => ({
      id: q.id,
      number: q.number,
      prompt: q.prompt,
      options: q.options as { label: string; text: string }[] | null,
      imageUrl: q.imageUrl,
      kind: q.kind,
      isOpenEnded: q.isOpenEnded,
    })),
  }));

  return (
    // pb clears both fixed bars below lg (64px tab bar + 48px back bar); at lg: only the back bar remains.
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-32 sm:px-6 sm:pt-8 lg:pb-20">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {listeningSet.level && <LevelBadge level={listeningSet.level} />}
        <h1 className="text-h1 font-heading">{listeningSet.title}</h1>
      </div>

      <div className="mb-5 border-b border-border" />

      <ListeningSetView
        slug={listeningSet.slug}
        audioUrl={listeningSet.audioUrl}
        transcriptMd={listeningSet.transcriptMd}
        sections={safeSections}
      />

      <ListeningBottomNav linkComponent={Link} subtitle={listeningSet.title} />
    </div>
  );
}
