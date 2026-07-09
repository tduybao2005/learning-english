import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { matchAnswer, type QuestionKind } from "@/lib/grading/match";
import { placementListeningSetId } from "@/lib/placement-listening";

const bodySchema = z.object({
  section: z.enum(["LISTENING", "READING"]),
  answers: z.array(z.object({ questionId: z.string().min(1), answerText: z.string() })),
});

/**
 * Grades one whole section (Listening or Reading) of the `default`
 * placement test in one call, via `matchAnswer` — the same server-side
 * grading function used everywhere else in the app, so the answer key
 * never reaches the client.
 *
 * Deliberately stateless (no DB writes, no `PlacementAttempt` row created
 * here): this is a placement TEST, not a practice exercise — there is no
 * per-question retry UI, so there is nothing to persist mid-test. The
 * wizard calls this once when the learner finishes the Nghe step and once
 * when they finish the Đọc step, carries the returned `rawScore` (and the
 * per-question `results`, needed later for `PlacementAttempt.answers`'s
 * audit trail) forward in memory, and only `POST /api/placement/complete`
 * — called once, after the Viết step — actually writes anything to the DB.
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
  const { section, answers } = parsed.data;

  const test = await db.placementTest.findUnique({ where: { slug: "default" } });
  if (!test) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  const listeningSetId = placementListeningSetId(test, user.goalType);
  if (section === "LISTENING" && !listeningSetId) {
    return NextResponse.json({ ok: false, reason: "no_listening_set" }, { status: 404 });
  }

  const questions = await db.question.findMany({
    where: { id: { in: answers.map((a) => a.questionId) } },
    include: { section: true, variants: true },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));

  let rawScore = 0;
  const results: Record<string, { text: string; isCorrect: boolean }> = {};

  for (const a of answers) {
    const question = byId.get(a.questionId);
    if (!question) continue; // ignore unknown ids defensively

    // Confirm this question genuinely belongs to the section being graded
    // (Reading -> this placement test's own Sections; Listening -> the
    // test's linked ListeningSet's Sections) — never grade a question from
    // somewhere else just because its id was posted.
    const belongsToSection =
      section === "READING"
        ? question.section.placementTestId === test.id
        : question.section.listeningSetId === listeningSetId;
    if (!belongsToSection) continue;

    const result = matchAnswer(a.answerText, {
      kind: question.section.kind as QuestionKind,
      isOpenEnded: question.isOpenEnded,
      variants: question.variants.map((v) => ({ normalized: v.normalized })),
    });
    if (result.correct) rawScore++;
    results[a.questionId] = { text: a.answerText, isCorrect: result.correct };
  }

  const total =
    section === "READING"
      ? await db.question.count({ where: { section: { placementTestId: test.id } } })
      : await db.question.count({ where: { section: { listeningSetId } } });

  return NextResponse.json({ ok: true, rawScore, total, results });
}
