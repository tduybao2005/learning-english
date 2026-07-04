import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getLessonStates } from "@/lib/progress";
import { getVocabStats } from "@/lib/vocab";
import { StatsRing } from "@/components/vocab/StatsRing";
import { buttonVariants } from "@/components/ui/button";
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
  const tabs = [
    { href: base, label: "Bài giảng", active: false },
    { href: `${base}/vocab`, label: "Từ vựng", active: true },
    { href: `${base}/exercise`, label: "Bài tập", active: false },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Quay lại lộ trình học
      </Link>

      <p className="text-sm font-medium text-primary">{lesson.phase.title}</p>
      <h1 className="mb-4 text-2xl font-bold">{lesson.title}</h1>

      <div className="mb-6 flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              tab.active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

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
