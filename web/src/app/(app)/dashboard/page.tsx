import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getLessonStates } from "@/lib/progress";
import { EmptyState } from "@/components/EmptyState";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Dashboard-only goal label: IELTS → "Band {value}", TOEIC → "TOEIC {value}",
 * CEFR → "{value}" (no "Chưa đặt mục tiêu" fallback here — callers already
 * branch on user having a goal before calling this). */
function formatGoalLabel(goalType: "IELTS" | "CEFR" | "TOEIC", goalValue: string): string {
  if (goalType === "IELTS") return `Band ${goalValue}`;
  if (goalType === "TOEIC") return `TOEIC ${goalValue}`;
  return goalValue;
}

export default async function DashboardPage() {
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

  const totalLessons = phases.reduce((sum, phase) => sum + phase.lessons.length, 0);
  const totalDone = phases.reduce(
    (sum, phase) =>
      sum +
      // Chỉ đếm COMPLETED. Bài kiểm tra đầu vào ghi SKIPPED cho mọi bài
      // trước điểm được xếp, nên gộp SKIPPED vào đây thì người vừa thi xong
      // đã thấy "23/52 bài đã hoàn thành" dù chưa học buổi nào — và con số
      // đó lệch hẳn với `/learn`, nơi tiến độ chỉ tính bài học thật.
      phase.lessons.filter((lesson) => states.get(lesson.id) === "COMPLETED").length,
    0,
  );
  const subtitleParts = totalLessons > 0 ? [`${totalDone}/${totalLessons} bài đã hoàn thành`] : [];

  const remainingPercent =
    totalLessons > 0 ? 100 - Math.round((totalDone / totalLessons) * 100) : null;
  const goalSubtitle =
    user.goalType && user.goalValue && remainingPercent !== null
      ? `Mục tiêu ${formatGoalLabel(user.goalType, user.goalValue)} · còn ${remainingPercent}% chặng đường`
      : subtitleParts.join(" · ");

  type NextUp = { phaseTitle: string; phaseSlug: string; lesson: (typeof phases)[number]["lessons"][number] } | null;
  let nextUp: NextUp = null;
  for (const phase of phases) {
    const lesson = phase.lessons.find((l) => states.get(l.id) === "UNLOCKED");
    if (lesson) {
      nextUp = { phaseTitle: phase.title, phaseSlug: phase.slug, lesson };
      break;
    }
  }

  // Question count for the "Tiếp tục" card. Questions hang off the lesson's
  // exercise through Section, so they cannot be a `_count` on Lesson — hence
  // this separate query, run only for the one lesson the card shows.
  const nextUpQuestionCount = nextUp
    ? await db.question.count({
        where: { section: { exercise: { lessonId: nextUp.lesson.id } } },
      })
    : 0;

  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

  const lessonsCompletedThisWeek = await db.lessonProgress.count({
    where: { userId: user.id, status: "COMPLETED", completedAt: { gte: startOfWeek } },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6">
      <div className="min-w-0 max-w-3xl lg:max-w-none">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 text-h1 font-extrabold tracking-tight">
              {user.name ? `Chào ${user.name} 👋` : "Chào bạn 👋"}
            </h2>
            {goalSubtitle ? (
              <p className="text-caption text-muted-foreground">{goalSubtitle}</p>
            ) : null}
          </div>
        </div>

        {/* "Tiếp tục" card — phone/tablet only. On `lg:` the same lesson is
            surfaced by the right-hand rail below, which must not change. */}
        {nextUp ? (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary bg-card p-4 lg:hidden">
            <p className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
              Tiếp tục
            </p>
            <div className="flex flex-col gap-1">
              {/* Seeded titles already start with "Bài N:", so no prefix here. */}
              <p className="text-h2 font-extrabold">{nextUp.lesson.title}</p>
              <p className="text-caption text-muted-foreground">
                {nextUp.phaseTitle} · {nextUp.lesson._count.words} từ vựng
                {nextUpQuestionCount > 0 ? ` · ${nextUpQuestionCount} câu hỏi` : ""}
              </p>
            </div>
            <Link
              href={`/learn/${nextUp.phaseSlug}/${nextUp.lesson.slug}`}
              className={cn(buttonVariants(), "min-h-11 w-full")}
            >
              Vào học
            </Link>
          </div>
        ) : null}

        {phases.length === 0 ? (
          <EmptyState
            icon="🌱"
            title="Chưa có gì ở đây"
            description="Nội dung bài học chưa được nạp vào hệ thống."
            linkComponent={Link}
          />
        ) : (
          <>
            {/* Lộ trình đầy đủ đã chuyển sang `/learn` (duyệt theo chủ đề).
                Dashboard giữ vai trò "hôm nay học gì", không lặp lại cả bản đồ. */}
            <Link
              href="/learn"
              className="press-tile flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12"
            >
              <span>
                <span className="block font-semibold">Xem lộ trình theo chủ đề</span>
                <span className="block text-caption text-muted-foreground">
                  {totalDone}/{totalLessons} bài đã hoàn thành
                </span>
              </span>
              <span aria-hidden className="text-muted-foreground">
                ›
              </span>
            </Link>
          </>
        )}
      </div>

      {/* Desktop rail: unchanged, and hidden below `lg:` (the design has no
          weekly-stats card, and its XP / new-words figures are hardcoded
          zeros with no backing field). */}
      <div className="mt-6 flex flex-col gap-4 max-lg:hidden lg:mt-0">
        {nextUp ? (
          <div className="rounded-xl bg-primary p-4 text-primary-foreground shadow-primary-glow">
            <p className="mb-2 text-xs font-medium opacity-80">Việc hôm nay</p>
            <p className="mb-3 font-semibold">
              Bài {nextUp.lesson.orderIndex} · {nextUp.lesson.title}
            </p>
            <Link
              href={`/learn/${nextUp.phaseSlug}/${nextUp.lesson.slug}`}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shadow-none")}
            >
              Tiếp tục học →
            </Link>
          </div>
        ) : null}

        {/* Only "Bài hoàn thành" is shown: it is the one figure with a query
            behind it. "XP kiếm được" and "Từ vựng mới" used to sit here as
            hardcoded zeros — no XP model exists, and VocabProgress is not
            timestamped, so neither could be computed. */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Tuần này</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Bài hoàn thành</span>
            <span className="font-semibold text-foreground">{lessonsCompletedThisWeek}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
