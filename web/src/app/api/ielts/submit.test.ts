import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

import { db } from "@/lib/db";

// Cùng lý do như `attempts/answers.test.ts`: `getSessionUser` đọc `cookies()`
// của Next, thứ chỉ tồn tại trong một request thật. Mock đúng lớp session mỏng
// này, còn Prisma/Postgres, `matchAnswer`, `rawToBand` và chính route handler
// đều chạy thật — đó mới là điểm của một integration test.
const sessionMock = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => sessionMock);

import { POST as submitReading } from "@/app/api/ielts/[n]/submit/route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const RUN_ID = Date.now().toString(36);

/** Đề đã xác minh (seed có 40 câu) và đề chưa xác minh (0 câu). */
const VERIFIED_TEST_NUMBER = 7;
const UNVERIFIED_TEST_NUMBER = 1;

let userId: string;
let questions: { id: string; answerText: string }[] = [];

describe("IELTS Reading submit API (integration, real Postgres)", () => {
  beforeAll(async () => {
    const user = await db.user.create({
      data: { email: `ielts_${RUN_ID}@test.local`, name: "IELTS Test" },
    });
    userId = user.id;

    const test = await db.ieltsTest.findUnique({
      where: { number: VERIFIED_TEST_NUMBER },
      include: { sections: { include: { questions: { include: { variants: true } } } } },
    });
    if (!test) throw new Error("test_07 chưa được seed — chạy `npm run seed:ielts` trước");

    // Đáp án ĐÚNG lấy từ chính variant trong DB (không bịa, không hardcode).
    questions = test.sections
      .flatMap((s) => s.questions)
      .sort((a, b) => a.number - b.number)
      .map((q) => ({ id: q.id, answerText: q.variants[0].text }));

    sessionMock.getSessionUser.mockResolvedValue({ id: userId, email: "x", name: "x" });
  });

  afterAll(async () => {
    await db.ieltsAttempt.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  });

  it("đề đã seed có đúng 40 câu để nộp", () => {
    expect(questions).toHaveLength(40);
  });

  it("nộp toàn đáp án đúng → 40/40 và band 9.0", async () => {
    const res = await submitReading(
      postRequest({ answers: questions.map((q) => ({ questionId: q.id, answerText: q.answerText })) }),
      { params: Promise.resolve({ n: String(VERIFIED_TEST_NUMBER) }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rawScore).toBe(40);
    expect(json.band).toBe(9);
    expect(json.results).toHaveLength(40);
    expect(json.results.every((r: { correct: boolean }) => r.correct)).toBe(true);
  });

  it("nộp toàn đáp án sai → 0 điểm, và MỖI câu sai trả về đáp án đúng", async () => {
    const res = await submitReading(
      postRequest({
        answers: questions.map((q) => ({ questionId: q.id, answerText: "zzz-sai-hoan-toan" })),
      }),
      { params: Promise.resolve({ n: String(VERIFIED_TEST_NUMBER) }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rawScore).toBe(0);
    expect(json.results.every((r: { correct: boolean }) => !r.correct)).toBe(true);
    expect(json.results.every((r: { correctAnswer?: string }) => Boolean(r.correctAnswer))).toBe(true);
  });

  it("chấm một phần: 1 câu đúng → rawScore = 1", async () => {
    const res = await submitReading(
      postRequest({
        answers: questions.map((q, i) => ({
          questionId: q.id,
          answerText: i === 0 ? q.answerText : "zzz-sai",
        })),
      }),
      { params: Promise.resolve({ n: String(VERIFIED_TEST_NUMBER) }) },
    );
    const json = await res.json();
    expect(json.rawScore).toBe(1);
  });

  it("đề CHƯA xác minh → 409, không chấm", async () => {
    const res = await submitReading(postRequest({ answers: [] }), {
      params: Promise.resolve({ n: String(UNVERIFIED_TEST_NUMBER) }),
    });
    expect(res.status).toBe(409);
  });

  it("chưa đăng nhập → 401", async () => {
    sessionMock.getSessionUser.mockResolvedValueOnce(null);
    const res = await submitReading(postRequest({ answers: [] }), {
      params: Promise.resolve({ n: String(VERIFIED_TEST_NUMBER) }),
    });
    expect(res.status).toBe(401);
  });
});
