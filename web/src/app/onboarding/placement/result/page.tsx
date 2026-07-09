import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { rawToBand, startLessonFor, scaleRawScore, type BandTableRow } from "@/lib/band";
import { placementListeningSetId } from "@/lib/placement-listening";
import { ResetToStartButton } from "@/components/ResetToStartButton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function PlacementResultPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const test = await db.placementTest.findUnique({ where: { slug: "default" } });
  if (!test) redirect("/onboarding/placement");

  const attempt = await db.placementAttempt.findFirst({
    where: { userId: user.id, testId: test.id, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
  });

  if (!attempt || attempt.band === null) {
    // Nothing completed yet — send them back to take the test.
    redirect("/onboarding/placement");
  }

  const listeningSetId = placementListeningSetId(test, user.goalType);
  const [readingTotal, listeningTotal] = await Promise.all([
    db.question.count({ where: { section: { placementTestId: test.id } } }),
    listeningSetId
      ? db.question.count({ where: { section: { listeningSetId } } })
      : Promise.resolve(0),
  ]);

  // Same scaling as `/api/placement/complete` (which is what actually
  // produced `attempt.band`) — recomputed here purely for the per-skill
  // display, using the raw counts stored on the attempt plus the current
  // true section totals. See `scaleRawScore`'s docstring for why this
  // scaling step exists (an unscaled short-section raw score floors at
  // band 0 against a table calibrated for 40 questions).
  const table = test.bandTable as unknown as BandTableRow[];
  const readingBand = rawToBand(scaleRawScore(attempt.readingScore ?? 0, readingTotal), table);
  const listeningBand = rawToBand(scaleRawScore(attempt.listeningScore ?? 0, listeningTotal), table);

  const { phaseSlug } = startLessonFor(attempt.band);
  // Fetched here (moved up from below the hero) so `phase?.cefrLabel` is
  // available for the hero's CEFR chip — same read-only lookup, no
  // duplicate query.
  const phase = await db.phase.findUnique({ where: { slug: phaseSlug } });
  const startLesson = phase
    ? await db.lesson.findFirst({ where: { phaseId: phase.id }, orderBy: { orderIndex: "asc" } })
    : null;

  const ctaHref = phase && startLesson ? `/learn/${phase.slug}/${startLesson.slug}` : "/dashboard";

  // Weaker of listening vs. reading gets the destructive bar color; the
  // other (and any tie) stays primary. Writing has no comparable band yet
  // (AI grading isn't live), so it's excluded from this comparison entirely.
  const weakerSkill: "listening" | "reading" =
    listeningBand <= readingBand ? "listening" : "reading";
  const listeningPercent = Math.min(100, Math.max(0, (listeningBand / 9) * 100));
  const readingPercent = Math.min(100, Math.max(0, (readingBand / 9) * 100));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="relative overflow-hidden rounded-b-3xl bg-primary px-6 py-10 text-center text-primary-foreground lg:flex lg:flex-col lg:items-center lg:justify-center lg:rounded-none">
        <span aria-hidden className="absolute top-14 right-1/4 hidden size-3 rotate-12 rounded-[3px] bg-accent lg:block" />
        <span aria-hidden className="absolute top-1/3 left-16 hidden size-3 -rotate-12 rounded-[3px] bg-streak lg:block" />
        <span aria-hidden className="absolute bottom-24 right-20 hidden size-2.5 rotate-45 rounded-[2px] bg-white/40 lg:block" />
        <p className="text-sm font-medium text-primary-foreground/80">Trình độ hiện tại của bạn</p>
        <p className="mt-2 text-[64px] font-extrabold leading-none lg:text-[96px]">{attempt.band.toFixed(1)}</p>
        {phase ? (
          <span className="mt-4 inline-block rounded-full bg-white/15 px-3 py-1 text-caption">
            Tương đương CEFR {phase.cefrLabel}
          </span>
        ) : null}
      </div>

      <div className="mx-auto flex max-w-lg flex-col items-center gap-8 px-4 py-12 text-center lg:justify-center lg:px-10 lg:py-8">
        <div className="w-full text-left">
          <p className="mb-3 text-caption font-semibold text-muted-foreground">
            Chi tiết từng kỹ năng
          </p>
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-medium">🎧 Nghe</span>
                <span className="font-bold">{listeningBand.toFixed(1)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full animate-progress-fill",
                    weakerSkill === "listening" ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${listeningPercent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {attempt.listeningScore ?? 0}/{listeningTotal} câu đúng
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-medium">📖 Đọc</span>
                <span className="font-bold">{readingBand.toFixed(1)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full animate-progress-fill",
                    weakerSkill === "reading" ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${readingPercent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {attempt.readingScore ?? 0}/{readingTotal} câu đúng
              </p>
            </div>

            {attempt.toeicListeningScore !== null ? (
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">🎯 Ước tính TOEIC Listening</span>
                  <span className="font-bold">{attempt.toeicListeningScore}/495</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Đây là điểm ước tính, không phải điểm thi TOEIC chính thức.
                </p>
              </div>
            ) : null}

            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-medium">✍️ Viết</span>
                <span className="text-sm font-medium text-muted-foreground">Đã lưu</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full border border-dashed border-muted-foreground/40" />
              <p className="mt-1 text-xs text-muted-foreground">chờ chấm điểm AI (sắp ra mắt)</p>
            </div>
          </div>
        </div>

        {/* Mobile keeps today's prose card; desktop (lg+) uses the compact card per mockup 04-d */}
        <div className="w-full rounded-xl border border-primary/30 bg-primary/5 p-5 lg:hidden">
          <p className="text-sm">
            Dựa trên kết quả này, chúng tôi đề xuất bạn bắt đầu học từ{" "}
            <span className="font-semibold">{phase?.title ?? "bài học đầu tiên"}</span>
            {startLesson ? (
              <>
                {" "}
                — bài <span className="font-semibold">&ldquo;{startLesson.title}&rdquo;</span>
              </>
            ) : null}
            . Các bài học trước đó sẽ được đánh dấu là đã bỏ qua (bạn vẫn có thể quay lại xem bất cứ lúc
            nào).
          </p>
        </div>
        <div className="hidden w-full rounded-xl border border-primary/25 bg-primary/5 p-5 text-left lg:block">
          <p className="text-caption text-muted-foreground">Điểm bắt đầu được gợi ý</p>
          <p className="mt-1 font-bold text-primary">
            {phase?.title ?? "Bài học đầu tiên"}
            {startLesson ? <> → {startLesson.title}</> : null}
          </p>
          <p className="mt-2 text-caption text-muted-foreground">
            Các bài học trước đó sẽ được đánh dấu là đã bỏ qua — bạn vẫn có thể quay lại xem bất
            cứ lúc nào.
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-3">
          <Link
            href={ctaHref}
            className={cn(buttonVariants({ size: "lg" }), "w-full lg:w-auto lg:min-w-64")}
          >
            Bắt đầu học ngay 🚀
          </Link>
          <ResetToStartButton />
        </div>
      </div>
    </div>
  );
}
