import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getVocabStats } from "@/lib/vocab";

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

  const percent = stats.total === 0 ? 0 : Math.round((stats.learned / stats.total) * 100);
  const base = `/learn/${phaseSlug}/${lessonSlug}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/vocab"
        className="press-btn mb-4 inline-block text-caption text-muted-foreground transition-all hover:text-foreground"
      >
        ← Quay lại Từ vựng
      </Link>
      <p className="text-caption font-semibold text-primary">{lesson.phase.title}</p>
      <h1 className="mb-6 text-h1 font-extrabold tracking-tight text-foreground">{lesson.title}</h1>

      {words.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          Bài học này chưa có từ vựng.
        </p>
      ) : (
        <>
          <div className="mb-6 rounded-full bg-primary px-5 py-3 text-primary-foreground">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>Tiến độ ghi nhớ</span>
              <span>
                {stats.learned}/{stats.total}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
            </div>
          </div>

          <p className="mb-3 text-caption font-semibold text-muted-foreground">
            Chọn chế độ luyện tập
          </p>
          <div className="mb-6 flex flex-col gap-2">
            <Link
              href={`${base}/vocab/flashcards`}
              className="press-tile flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md active:shadow-none"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-lg">
                🃏
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">Thẻ ghi nhớ</span>
                <span className="block text-caption text-muted-foreground">
                  Lật thẻ để ôn nghĩa từ
                </span>
              </span>
              <span className="text-muted-foreground">›</span>
            </Link>
            <Link
              href={`${base}/vocab/play`}
              className="press-tile flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md active:shadow-none"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-streak-bg text-lg">
                ⚡
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">Luyện tập</span>
                <span className="block text-caption text-muted-foreground">
                  Ghép cặp + trắc nghiệm · tự ôn lại từ sai
                </span>
              </span>
              <span className="text-muted-foreground">›</span>
            </Link>
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
