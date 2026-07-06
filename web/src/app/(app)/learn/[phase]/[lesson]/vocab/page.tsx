import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getLessonStates } from "@/lib/progress";
import { getVocabStats } from "@/lib/vocab";
import { StatsRing } from "@/components/vocab/StatsRing";
import { buttonVariants } from "@/components/ui/button";
import { LessonTabs } from "@/components/LessonTabs";
import { cn } from "@/lib/utils";

export default async function VocabHubPage({
  params,
}: {
  params: Promise<{ phase: string; lesson: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { phase: phaseSlug, lesson: lessonSlug } = await params;

  const lesson = await db.lesson.findFirst({
    where: { slug: lessonSlug, phase: { slug: phaseSlug } },
    include: { phase: true },
  });

  if (!lesson) notFound();

  // Guard: a locked lesson's URL is not viewable — bounce back to the dashboard.
  const states = await getLessonStates(user.id);
  const state = states.get(lesson.id) ?? "LOCKED";
  if (state === "LOCKED") redirect("/dashboard");

  const [words, stats] = await Promise.all([
    db.vocabWord.findMany({
      where: { lessonId: lesson.id },
      orderBy: { orderIndex: "asc" },
      select: { groupName: true },
    }),
    getVocabStats(user.id, lesson.id),
  ]);

  // Group by groupName, preserving the order groups first appear in
  // (== curriculum orderIndex order, since `words` was already ordered).
  const groups: { name: string; count: number }[] = [];
  const groupIndexByName = new Map<string, number>();
  for (const w of words) {
    let idx = groupIndexByName.get(w.groupName);
    if (idx === undefined) {
      idx = groups.length;
      groupIndexByName.set(w.groupName, idx);
      groups.push({ name: w.groupName, count: 0 });
    }
    groups[idx].count += 1;
  }

  const base = `/learn/${phaseSlug}/${lessonSlug}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <LessonTabs
        phaseTitle={lesson.phase.title}
        lessonTitle={lesson.title}
        basePath={base}
        active="vocab"
      />

      {words.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          Bài học này chưa có từ vựng.
        </p>
      ) : (
        <>
          <div className="mb-6 flex flex-col items-center gap-5 rounded-xl border border-border bg-card p-6 sm:flex-row sm:justify-between">
            <StatsRing learned={stats.learned} total={stats.total} />
            <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
              <Link
                href={`${base}/vocab/flashcards`}
                className={cn(buttonVariants(), "justify-center")}
              >
                🗂️ Flashcards
              </Link>
              <Link
                href={`${base}/vocab/quiz`}
                className={cn(buttonVariants({ variant: "outline" }), "justify-center")}
              >
                ❓ Trắc nghiệm
              </Link>
              <Link
                href={`${base}/vocab/match`}
                className={cn(buttonVariants({ variant: "outline" }), "justify-center")}
              >
                🔗 Nối từ
              </Link>
            </div>
          </div>

          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Nhóm từ vựng ({words.length} từ)
          </h2>
          <div className="space-y-2">
            {groups.map((group) => (
              <div
                key={group.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="text-sm font-medium">{group.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{group.count} từ</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
