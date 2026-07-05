import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { assignStartPoint } from "@/lib/progress";

/**
 * "Tôi muốn bắt đầu từ đầu" (result page): overrides whatever
 * `/api/placement/complete` assigned and instead starts the learner at the
 * very first lesson of the whole curriculum, clearing any SKIPPED rows
 * `assignStartPoint` had written for the placement-assigned phase. Does
 * NOT touch `User.placementBand` or the `PlacementAttempt` row — the band
 * is still a true record of the test result, only the chosen starting
 * point changes.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const firstLesson = await db.lesson.findFirst({
    orderBy: [{ phase: { orderIndex: "asc" } }, { orderIndex: "asc" }],
  });
  if (!firstLesson) {
    return NextResponse.json({ ok: false, reason: "no_curriculum_seeded" }, { status: 500 });
  }

  await db.$transaction(async (tx) => {
    await assignStartPoint(tx, user.id, firstLesson.id);
  });

  return NextResponse.json({ ok: true, startLessonSlug: firstLesson.slug });
}
