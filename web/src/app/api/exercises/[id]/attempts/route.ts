import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getOrCreateOpenAttempt } from "@/lib/attempts";

const bodySchema = z.object({ redo: z.boolean().optional() });

/**
 * Resumes the learner's open (not-yet-completed) attempt on this exercise,
 * or — when `{redo: true}` is sent — always creates a fresh attempt (the old
 * one, and all its `AttemptAnswer` rows, are left untouched).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const { id: exerciseId } = await params;

  const exercise = await db.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(rawBody ?? {});
  const redo = parsed.success && parsed.data.redo === true;

  const attempt = redo
    ? await db.exerciseAttempt.create({ data: { userId: user.id, exerciseId } })
    : await getOrCreateOpenAttempt(user.id, exerciseId);

  return NextResponse.json({
    attemptId: attempt.id,
    currentQuestionNumber: attempt.currentQuestionNumber,
  });
}
