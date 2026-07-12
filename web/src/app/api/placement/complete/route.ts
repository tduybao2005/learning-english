import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { rawToBand, placementBand, startLessonFor, scaleRawScore, type BandTableRow } from "@/lib/band";
import { rawToToeicListening } from "@/lib/toeic";
import { getFirstLessonOfPhase, assignStartPoint } from "@/lib/progress";
import { placementListeningSetId } from "@/lib/placement-listening";
import { gradePlacementSection, type GradableQuestion } from "@/lib/placement-grading";
import type { QuestionKind } from "@/lib/grading/match";

const bodySchema = z.object({
  // Câu trả lời thô của người học cho từng section. Điểm KHÔNG do client gửi
  // nữa (trước đây `readingScore`/`listeningScore` bị tin tưởng → gửi điểm
  // giả là nhảy giai đoạn); server tự chấm lại các câu này bằng `matchAnswer`.
  listeningAnswers: z.record(z.string(), z.string()).default({}),
  readingAnswers: z.record(z.string(), z.string()).default({}),
  writingText: z.string(),
});

/**
 * Finalizes a placement-test attempt: computes the overall band from the
 * two already-graded section scores, persists a `PlacementAttempt` row,
 * sets `User.placementBand`, and assigns the learner's curriculum start
 * point (SKIPPED for every lesson before it, UNLOCKED for it).
 *
 * Writing is intentionally NOT scored here — `writingBand`/`writingFeedback`
 * stay null (deferred to a future AI grading pass); only `writingText` is
 * stored, per the plan's explicit deferred-work list.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const { writingText } = parsed.data;

  const test = await db.placementTest.findUnique({ where: { slug: "default" } });
  if (!test) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const listeningSetId = placementListeningSetId(test, user.goalType);

  // Nạp bộ câu hỏi THẬT của mỗi section (Reading = Sections của placement
  // test; Listening = Sections của ListeningSet đã liên kết) rồi tự chấm
  // server-side. Điểm không bao giờ tin từ client — kẻ tấn công không biết
  // answer key nên không thể gửi điểm giả để nhảy giai đoạn.
  const [readingQs, listeningQs] = await Promise.all([
    db.question.findMany({
      where: { section: { placementTestId: test.id } },
      include: { section: true, variants: true },
    }),
    listeningSetId
      ? db.question.findMany({
          where: { section: { listeningSetId } },
          include: { section: true, variants: true },
        })
      : Promise.resolve([]),
  ]);

  const toGradable = (q: (typeof readingQs)[number]): GradableQuestion => ({
    id: q.id,
    kind: q.section.kind as QuestionKind,
    isOpenEnded: q.isOpenEnded,
    variants: q.variants.map((v) => ({ normalized: v.normalized })),
  });

  const readingGraded = gradePlacementSection(readingQs.map(toGradable), parsed.data.readingAnswers);
  const listeningGraded = gradePlacementSection(
    listeningQs.map(toGradable),
    parsed.data.listeningAnswers,
  );
  const readingScore = readingGraded.rawScore;
  const listeningScore = listeningGraded.rawScore;
  const readingTotal = readingQs.length;
  const listeningTotal = listeningQs.length;
  // Audit map dựng hoàn toàn server-side từ kết quả chấm thật.
  const answers = { ...listeningGraded.results, ...readingGraded.results };

  // The band table (`ielts_practice_tests/test_01/answer_key.md`) is
  // calibrated for a standard 40-question section; this placement test's
  // sections are shorter (26 reading, 10 listening) to keep it brief, so
  // each raw score is scaled onto that standard total before lookup — see
  // `scaleRawScore`'s docstring for the real bug this fixes (an unscaled
  // 8/10 listening score floors at band 0).
  const table = test.bandTable as unknown as BandTableRow[];
  const scaledReading = scaleRawScore(readingScore, readingTotal);
  const scaledListening = scaleRawScore(listeningScore, listeningTotal);
  const readingBand = rawToBand(scaledReading, table);
  const listeningBand = rawToBand(scaledListening, table);
  const band = placementBand(scaledReading, scaledListening, table);

  // TOEIC-goal learners additionally get an estimated TOEIC Listening
  // scaled score (5-495), computed from the UNSCALED raw listening score
  // (out of its own total, not the 40-question band-table projection above)
  // — an estimate only, ETS publishes no official conversion (see
  // `rawToToeicListening`'s docstring).
  const toeicListeningScore =
    user.goalType === "TOEIC" && listeningTotal > 0
      ? rawToToeicListening(Math.round((listeningScore / listeningTotal) * 100))
      : null;

  const { phaseSlug } = startLessonFor(band);
  let startLesson = await getFirstLessonOfPhase(phaseSlug);
  // Defensive fallback: if the target phase somehow has no lessons seeded
  // yet, fall back to the very first lesson overall rather than leaving
  // the learner with no assigned start point at all.
  if (!startLesson) {
    startLesson = await db.lesson.findFirst({
      orderBy: [{ phase: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    });
  }
  if (!startLesson) {
    return NextResponse.json({ ok: false, reason: "no_curriculum_seeded" }, { status: 500 });
  }

  await db.$transaction(async (tx) => {
    await tx.placementAttempt.create({
      data: {
        userId: user.id,
        testId: test.id,
        completedAt: new Date(),
        readingScore,
        listeningScore,
        toeicListeningScore,
        band,
        writingText,
        answers: answers as Prisma.InputJsonValue,
      },
    });
    await tx.user.update({ where: { id: user.id }, data: { placementBand: band } });
    await assignStartPoint(tx, user.id, startLesson.id);
  });

  return NextResponse.json({
    ok: true,
    band,
    readingBand,
    listeningBand,
    toeicListeningScore,
    phaseSlug,
    startLessonSlug: startLesson.slug,
  });
}
