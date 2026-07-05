import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { rawToBand, startLessonFor, scaleRawScore, type BandTableRow } from "@/lib/band";
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

  const [readingTotal, listeningTotal] = await Promise.all([
    db.question.count({ where: { section: { placementTestId: test.id } } }),
    test.listeningSetId
      ? db.question.count({ where: { section: { listeningSetId: test.listeningSetId } } })
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
  const phase = await db.phase.findUnique({ where: { slug: phaseSlug } });
  const startLesson = phase
    ? await db.lesson.findFirst({ where: { phaseId: phase.id }, orderBy: { orderIndex: "asc" } })
    : null;

  const ctaHref = phase && startLesson ? `/learn/${phase.slug}/${startLesson.slug}` : "/dashboard";

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Kết quả bài kiểm tra đầu vào</p>
        <p className="mt-2 text-7xl font-extrabold tracking-tight text-primary">{attempt.band.toFixed(1)}</p>
        <p className="mt-1 text-sm text-muted-foreground">Band điểm ước tính (IELTS)</p>
      </div>

      <div className="grid w-full grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Nghe</p>
          <p className="text-lg font-bold">{listeningBand.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">
            {attempt.listeningScore ?? 0}/{listeningTotal} câu đúng
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Đọc</p>
          <p className="text-lg font-bold">{readingBand.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">
            {attempt.readingScore ?? 0}/{readingTotal} câu đúng
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Viết</p>
          <p className="text-sm font-medium text-muted-foreground">Đã lưu</p>
          <p className="text-xs text-muted-foreground">chờ chấm điểm AI (sắp ra mắt)</p>
        </div>
      </div>

      <div className="w-full rounded-xl border border-primary/30 bg-primary/5 p-5">
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

      <div className="flex w-full flex-col items-center gap-3">
        <Link href={ctaHref} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          Bắt đầu học
        </Link>
        <ResetToStartButton />
      </div>
    </div>
  );
}
