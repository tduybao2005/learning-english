import NextLink from "next/link";
import { redirect } from "next/navigation";
import type { CefrLevel } from "@prisma/client";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { EmptyState } from "@/components/EmptyState";
import { LevelBadge } from "@/components/LevelBadge";
import { ListeningSetCard } from "@/components/ListeningSetCard";
import { LEVEL_ORDER } from "@/lib/listening-ui";

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
                  <LevelBadge level={group.level} />
                ) : (
                  <h2 className="font-semibold">Khác</h2>
                )}
                <span className="text-caption text-muted-foreground">· {group.sets.length} bài</span>
              </div>
              <div className="flex flex-col gap-3">
                {group.sets.map((set) => (
                  <ListeningSetCard
                    key={set.slug}
                    href={`/listening/${set.slug}`}
                    title={set.title}
                    questionCount={set.sections.reduce((n, s) => n + s._count.questions, 0)}
                    durationLabel={set.durationSec ? formatDuration(set.durationSec) : undefined}
                    linkComponent={NextLink}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
