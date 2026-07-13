import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { matchAnswer, type QuestionKind } from "@/lib/grading/match";
import { rawToBand, type BandTableRow } from "@/lib/band";

const bodySchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      answerText: z.string(),
    }),
  ),
});

/**
 * Chấm CẢ bài Reading một lần, khi người học bấm "Nộp bài".
 *
 * Chấm hoàn toàn phía server: đáp án chỉ rời DB SAU khi đã nộp. Trang đề không
 * được phép nhận đáp án kèm HTML — mở DevTools là thấy hết, và đó chính là lý do
 * trang cũ (accordion lộ sẵn key) vô dụng như một bài thi.
 *
 * Chỉ chấm đề có `readingKeyVerified` (20/30, xem `VERIFIED_READING_TESTS`).
 * Đề chưa xác minh → 409, ngay cả khi client cố gọi thẳng API: UI giấu nút nộp
 * là chưa đủ, API phải tự bảo vệ.
 *
 * Band trả về là **band Reading**, quy đổi bằng bảng của CHÍNH đề đó
 * (`IeltsTest.bandTable`) — hard rule của repo: không phần trăm, không mượn bảng
 * đề khác.
 */
export async function POST(request: Request, { params }: { params: Promise<{ n: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const { n } = await params;
  const number = Number(n);
  if (!Number.isInteger(number)) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const test = await db.ieltsTest.findUnique({
    where: { number },
    include: {
      sections: { include: { questions: { include: { variants: true } } } },
    },
  });
  if (!test) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  if (!test.readingKeyVerified || !test.bandTable) {
    return NextResponse.json({ ok: false, reason: "not_gradeable" }, { status: 409 });
  }

  // Câu hỏi của đề này, tra theo id — một questionId của đề KHÁC gửi vào đây sẽ
  // không khớp và bị bỏ qua, không thể dùng để moi đáp án đề khác.
  const questions = new Map(
    test.sections.flatMap((s) => s.questions.map((q) => [q.id, { ...q, sectionKind: s.kind }])),
  );

  const submitted = new Map(parsed.data.answers.map((a) => [a.questionId, a.answerText]));

  const attempt = await db.ieltsAttempt.create({
    data: { userId: user.id, ieltsTestId: test.id },
  });

  const results: {
    questionId: string;
    number: number;
    correct: boolean;
    correctAnswer: string;
    explanation: string | null;
  }[] = [];

  for (const question of questions.values()) {
    // Câu bỏ trống vẫn được chấm — là sai, và vẫn hiện đáp án + giải thích.
    const answerText = submitted.get(question.id) ?? "";
    const match = matchAnswer(answerText, {
      kind: question.sectionKind as QuestionKind,
      isOpenEnded: question.isOpenEnded,
      variants: question.variants.map((v) => ({ normalized: v.normalized })),
    });

    results.push({
      questionId: question.id,
      number: question.number,
      correct: match.correct,
      correctAnswer: question.answerRaw,
      explanation: question.keyNote,
    });

    await db.ieltsAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: question.id,
        answerText,
        isCorrect: match.correct,
        matchType: match.correct ? match.matchType : null,
      },
    });
  }

  results.sort((a, b) => a.number - b.number);

  const rawScore = results.filter((r) => r.correct).length;
  const band = rawToBand(rawScore, test.bandTable as unknown as BandTableRow[]);

  await db.ieltsAttempt.update({
    where: { id: attempt.id },
    data: { submittedAt: new Date(), rawScore, band },
  });

  return NextResponse.json({ attemptId: attempt.id, rawScore, band, results });
}
