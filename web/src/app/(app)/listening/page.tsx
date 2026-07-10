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

  const unleveled = sets.filter((s) => s.level === null);
  const groups: { level: CefrLevel | null; sets: typeof sets }[] = [
    // Every CEFR level shows, even with no sets — an empty one renders a
    // "sắp ra mắt" card so the learner can see the road ahead.
    ...LEVEL_ORDER.map((level) => ({
      level: level as CefrLevel | null,
      sets: sets.filter((s) => s.level === level),
    })),
    // Defensive bucket for PRACTICE sets missing a level (seed WARNs on these).
    // Unlike the CEFR groups, this one only appears when it has something in it.
    ...(unleveled.length > 0 ? [{ level: null, sets: unleveled }] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-h1 font-heading">Luyện nghe</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Chọn bài nghe theo cấp độ. Mỗi bài gồm 4 phần với 40 câu hỏi — hoàn thành từng phần để mở
          khóa lời thoại.
        </p>
      </header>

      {sets.length === 0 ? (
        <EmptyState
          icon="🎧"
          title="Chưa có bài nghe nào"
          description="Quay lại sau để luyện nghe nhé."
          linkComponent={NextLink}
        />
      ) : (
        groups.map((group) => (
          <section key={group.level ?? "other"} className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              {group.level ? (
                <h2>
                  <LevelBadge level={group.level} className="px-3 py-1 text-sm" />
                </h2>
              ) : (
                <h2 className="text-h2 font-heading">Khác</h2>
              )}
              <span className="text-caption text-muted-foreground">
                {group.sets.length > 0 ? `${group.sets.length} bộ bài` : "Sắp ra mắt"}
              </span>
            </div>

            {group.sets.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            ) : (
              <div className="rounded-xl border border-border bg-card">
                <EmptyState
                  icon="🎧"
                  title="Chưa có bài nghe cho cấp độ này"
                  description="Các bài nghe đang được biên soạn. Trong lúc chờ, hãy luyện thêm ở cấp độ thấp hơn."
                  linkComponent={NextLink}
                />
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
