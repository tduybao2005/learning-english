import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getOrderedListeningSections } from "@/lib/listening";
import { ListeningSetView } from "@/components/ListeningSetView";
import type { SafeListeningSection } from "@/components/ListeningRunner";
import { LEVEL_META } from "@/lib/listening-ui";
import { cn } from "@/lib/utils";

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
    <div className="mx-auto max-w-3xl px-4 py-8 lg:max-w-5xl">
      <Link
        href="/listening"
        className="mb-4 inline-block text-caption text-muted-foreground hover:text-foreground"
      >
        ← Quay lại luyện nghe
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-h1 font-bold">{listeningSet.title}</h1>
        {listeningSet.level && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-bold",
              LEVEL_META[listeningSet.level].badgeClass,
            )}
          >
            {listeningSet.level} · {LEVEL_META[listeningSet.level].labelVi}
          </span>
        )}
      </div>

      <ListeningSetView
        slug={listeningSet.slug}
        audioUrl={listeningSet.audioUrl}
        transcriptMd={listeningSet.transcriptMd}
        sections={safeSections}
      />
    </div>
  );
}
