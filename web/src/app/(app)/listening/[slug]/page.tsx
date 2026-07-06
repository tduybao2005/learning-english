import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getOrderedListeningQuestions } from "@/lib/listening";
import { ListeningSetView } from "@/components/ListeningSetView";
import type { SafeQuestion } from "@/components/runner/QuestionCard";

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
  const ordered = await getOrderedListeningQuestions(listeningSet.id);
  const questions: SafeQuestion[] = ordered.map((q) => ({
    id: q.id,
    number: q.number,
    prompt: q.prompt,
    options: q.options as { label: string; text: string }[] | null,
    kind: q.kind,
    isOpenEnded: q.isOpenEnded,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/listening"
        className="mb-4 inline-block text-caption text-muted-foreground hover:text-foreground"
      >
        ← Quay lại luyện nghe
      </Link>

      <h1 className="mb-6 text-h1 font-bold">{listeningSet.title}</h1>

      <ListeningSetView
        slug={listeningSet.slug}
        audioUrl={listeningSet.audioUrl}
        transcriptMd={listeningSet.transcriptMd}
        questions={questions}
      />
    </div>
  );
}
