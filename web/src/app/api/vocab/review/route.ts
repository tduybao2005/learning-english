import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { applyReviewResults } from "@/lib/vocab";

const bodySchema = z.object({
  results: z.array(
    z.object({
      wordId: z.string().min(1),
      correct: z.boolean(),
    }),
  ),
});

/**
 * Batch-applies a flashcard session's Leitner review results for the signed-in
 * user. Called once at the end of a session (not per-card) — see
 * `Flashcards.tsx`.
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

  await applyReviewResults(user.id, parsed.data.results);

  return NextResponse.json({ ok: true });
}
