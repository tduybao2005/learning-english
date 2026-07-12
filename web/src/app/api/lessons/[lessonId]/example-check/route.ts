import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { parseLectureExamples } from "@/lib/lecture-examples";
import { gradeExample } from "@/lib/example-grading";

const bodySchema = z.object({
  exampleId: z.string().min(1),
  input: z.string(),
  reveal: z.boolean().optional(),
});

/**
 * Stateless check for an inline lecture example.
 *
 * Persists nothing: lecture examples are teaching aids inside the lecture
 * body, not graded exercises — they don't gate progress and don't need
 * attempt rows. The example definition lives in `Lesson.lectureMd` and is
 * parsed on demand, so no new models are needed. As everywhere else in the
 * app, the answer never reaches the client except on an explicit reveal or
 * after a correct check.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const { lessonId } = await params;

  const rawBody = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const { exampleId, input, reveal } = parsed.data;

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { lectureMd: true },
  });
  if (!lesson) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const example = parseLectureExamples(lesson.lectureMd).find((e) => e.id === exampleId);
  if (!example) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  return NextResponse.json(gradeExample(example, input, reveal === true));
}
