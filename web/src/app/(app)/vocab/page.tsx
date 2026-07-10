import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getLessonStates } from "@/lib/progress";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

/** Top-level vocab hub: every phase's lessons that actually have vocab
 * words, so a learner can jump straight into any unlocked lesson's vocab
 * practice without drilling through the lesson map. Locked lessons are
 * listed (so the curriculum stays visible) but rendered disabled — their
 * `/vocab` URL would just bounce back to `/dashboard` anyway. */
export default async function VocabHubPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [phases, states] = await Promise.all([
    db.phase.findMany({
      orderBy: { orderIndex: "asc" },
      include: {
        lessons: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            slug: true,
            title: true,
            orderIndex: true,
            _count: { select: { words: true } },
          },
        },
      },
    }),
    getLessonStates(user.id),
  ]);

  const phaseGroups = phases
    .map((phase) => ({
      ...phase,
      lessons: phase.lessons.filter((lesson) => lesson._count.words > 0),
    }))
    .filter((phase) => phase.lessons.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-h1 font-extrabold">Từ vựng</h1>
      <p className="mb-6 text-body text-muted-foreground">
        Chọn một bài học để luyện từ vựng bằng thẻ ghi nhớ, quiz hoặc ghép cặp.
      </p>

      {phaseGroups.length === 0 ? (
        <EmptyState
          icon="📖"
          title="Chưa có từ vựng nào"
          description="Quay lại sau khi nội dung từ vựng được thêm vào."
          linkComponent={Link}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {phaseGroups.map((phase) => (
            <div key={phase.id}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                GĐ {phase.orderIndex} · {phase.title}
              </h2>
              <div className="flex flex-col gap-2">
                {phase.lessons.map((lesson) => {
                  const state = states.get(lesson.id) ?? "LOCKED";
                  const locked = state === "LOCKED";
                  const content = (
                    <>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">
                          Bài {lesson.orderIndex} · {lesson.title}
                        </span>
                        <span className="block text-caption text-muted-foreground">
                          {lesson._count.words} từ
                        </span>
                      </span>
                      {locked ? (
                        <Lock className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <span className="text-muted-foreground">›</span>
                      )}
                    </>
                  );

                  if (locked) {
                    return (
                      <div
                        key={lesson.id}
                        className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-border bg-card p-4 opacity-70"
                      >
                        {content}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={lesson.id}
                      href={`/learn/${phase.slug}/${lesson.slug}/vocab`}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md",
                      )}
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
