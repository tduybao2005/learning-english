import Link from "next/link";
import { redirect } from "next/navigation";
import type { CefrLevel } from "@prisma/client";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { EmptyState } from "@/components/EmptyState";
import { LEVEL_META, LEVEL_ORDER } from "@/lib/listening-ui";
import { cn } from "@/lib/utils";

function formatDuration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.round(sec / 60);
  return `~${m} phút`;
}

export default async function ListeningHubPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Only PRACTICE-kind sets are browsable here — PLACEMENT sets are consumed
  // exclusively through the onboarding placement wizard.
  const sets = await db.listeningSet.findMany({
    where: { kind: "PRACTICE" },
    orderBy: { slug: "asc" },
    select: {
      slug: true,
      title: true,
      durationSec: true,
      level: true,
      sections: { select: { _count: { select: { questions: true } } } },
    },
  });

  const groups: { level: CefrLevel | null; sets: typeof sets }[] = [
    ...LEVEL_ORDER.map((level) => ({
      level: level as CefrLevel | null,
      sets: sets.filter((s) => s.level === level),
    })),
    // Defensive bucket for PRACTICE sets missing a level (seed WARNs on these).
    { level: null, sets: sets.filter((s) => s.level === null) },
  ].filter((g) => g.sets.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Luyện nghe</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Chọn bài nghe theo cấp độ. Mỗi bài gồm 4 phần với 40 câu hỏi — hoàn thành từng phần để mở
        khóa lời thoại.
      </p>

      {sets.length === 0 ? (
        <EmptyState icon="🎧" title="Chưa có bài nghe nào" description="Quay lại sau để luyện nghe nhé." />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.level ?? "other"}>
              <div className="mb-3 flex items-center gap-2">
                {group.level ? (
                  <>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", LEVEL_META[group.level].badgeClass)}>
                      {group.level}
                    </span>
                    <h2 className="font-semibold">{LEVEL_META[group.level].labelVi}</h2>
                  </>
                ) : (
                  <h2 className="font-semibold">Khác</h2>
                )}
                <span className="text-caption text-muted-foreground">· {group.sets.length} bài</span>
              </div>
              <div className="flex flex-col gap-3">
                {group.sets.map((set) => {
                  const qCount = set.sections.reduce((n, s) => n + s._count.questions, 0);
                  return (
                    <Link
                      key={set.slug}
                      href={`/listening/${set.slug}`}
                      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-lg">
                        🎧
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{set.title}</p>
                        <p className="text-caption text-muted-foreground">
                          {qCount} câu{set.durationSec ? ` · ${formatDuration(set.durationSec)}` : ""}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
