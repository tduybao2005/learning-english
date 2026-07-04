import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

import { db } from "@/lib/db";

// `getSessionUser` reads the request-scoped `cookies()` from `next/headers`,
// which throws when called outside a real Next.js request (verified: calling
// it directly in a plain vitest run throws "cookies was called outside a
// request scope"). Mocking just this thin session layer lets everything else
// under test — Prisma/Postgres, `matchAnswer`, `explainer`, `getNextLesson`,
// and the two route handlers' own logic — run for real against the local
// Postgres instance, which is the point of this being an integration test.
const sessionMock = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => sessionMock);

import { POST as createAttempt } from "@/app/api/exercises/[id]/attempts/route";
import { POST as submitAnswer } from "@/app/api/attempts/[id]/answers/route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const RUN_ID = Date.now().toString(36);

let userId: string;
let lessonAId: string;
let lessonBId: string;
let exerciseId: string;
let q1Id: string; // FILL_BLANK, single blank
let q2Id: string; // FILL_BLANK, final question in the mini-exercise

describe("exercise runner API (integration, real Postgres)", () => {
  beforeAll(async () => {
    const phase = await db.phase.create({
      data: {
        slug: `test_phase_${RUN_ID}`,
        orderIndex: 100000,
        title: "Test Phase",
        cefrLabel: "A1",
      },
    });

    const lessonA = await db.lesson.create({
      data: {
        phaseId: phase.id,
        slug: `test_lesson_a_${RUN_ID}`,
        orderIndex: 0,
        title: "Test Lesson A",
        lectureMd: "# Test",
        sourceDir: "test",
        contentHash: "test-hash-a",
      },
    });
    const lessonB = await db.lesson.create({
      data: {
        phaseId: phase.id,
        slug: `test_lesson_b_${RUN_ID}`,
        orderIndex: 1,
        title: "Test Lesson B",
        lectureMd: "# Test",
        sourceDir: "test",
        contentHash: "test-hash-b",
      },
    });
    lessonAId = lessonA.id;
    lessonBId = lessonB.id;

    const exercise = await db.exercise.create({
      data: { lessonId: lessonA.id, title: "Mini Exercise" },
    });
    exerciseId = exercise.id;

    const section = await db.section.create({
      data: {
        exerciseId: exercise.id,
        label: "A",
        title: "Fill in the blank",
        kind: "FILL_BLANK",
        orderIndex: 0,
      },
    });

    const q1 = await db.question.create({
      data: {
        sectionId: section.id,
        number: 1,
        prompt: "My mother ______ (cook) dinner every evening.",
        answerRaw: "cooks",
        keyNote: "simple present, 3rd person singular",
        variants: { create: [{ text: "cooks", normalized: "cooks" }] },
      },
    });
    const q2 = await db.question.create({
      data: {
        sectionId: section.id,
        number: 2,
        prompt: "Water ______ (freeze) at 0 degrees Celsius.",
        answerRaw: "freezes",
        variants: { create: [{ text: "freezes", normalized: "freezes" }] },
      },
    });
    q1Id = q1.id;
    q2Id = q2.id;

    const user = await db.user.create({
      data: { email: `runner-test-${RUN_ID}@example.com` },
    });
    userId = user.id;
    sessionMock.getSessionUser.mockResolvedValue(user);
  });

  afterAll(async () => {
    // Reverse-dependency order cleanup (no cascades wired from User/Phase).
    await db.lessonProgress.deleteMany({ where: { userId } });
    await db.attemptAnswer.deleteMany({ where: { attempt: { userId } } });
    await db.exerciseAttempt.deleteMany({ where: { userId } });
    await db.exercise.delete({ where: { id: exerciseId } }); // cascades Section/Question/AnswerVariant
    await db.lesson.deleteMany({ where: { id: { in: [lessonAId, lessonBId] } } });
    await db.phase.deleteMany({ where: { slug: `test_phase_${RUN_ID}` } });
    await db.user.delete({ where: { id: userId } });
  });

  it("creates a fresh attempt at question 1 when none exists yet", async () => {
    const res = await createAttempt(postRequest({}), { params: Promise.resolve({ id: exerciseId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.currentQuestionNumber).toBe(1);
    expect(typeof json.attemptId).toBe("string");
  });

  it("resumes the same open attempt on a second call (no redo)", async () => {
    const first = await createAttempt(postRequest({}), { params: Promise.resolve({ id: exerciseId }) });
    const firstJson = await first.json();

    const second = await createAttempt(postRequest({}), { params: Promise.resolve({ id: exerciseId }) });
    const secondJson = await second.json();

    expect(secondJson.attemptId).toBe(firstJson.attemptId);
  });

  it("wrong answer -> correct:false, wrongAnswers grows, explanation stays null (NullExplainer)", async () => {
    const created = await createAttempt(postRequest({ redo: true }), {
      params: Promise.resolve({ id: exerciseId }),
    });
    const { attemptId } = await created.json();

    const res1 = await submitAnswer(postRequest({ questionId: q1Id, answerText: "cook" }), {
      params: Promise.resolve({ id: attemptId }),
    });
    const json1 = await res1.json();
    expect(json1.correct).toBe(false);
    expect(json1.explanation).toBeNull();

    const res2 = await submitAnswer(postRequest({ questionId: q1Id, answerText: "cooking" }), {
      params: Promise.resolve({ id: attemptId }),
    });
    const json2 = await res2.json();
    expect(json2.correct).toBe(false);
    expect(json2.explanation).toBeNull();

    const stored = await db.attemptAnswer.findUnique({
      where: { attemptId_questionId: { attemptId, questionId: q1Id } },
    });
    expect(stored?.isCorrect).toBe(false);
    expect(stored?.tries).toBe(2);
    expect(stored?.wrongAnswers).toEqual(["cook", "cooking"]);
    expect(stored?.explanation).toBeNull();

    // Attempt shouldn't have advanced past question 1 on wrong answers.
    const attempt = await db.exerciseAttempt.findUnique({ where: { id: attemptId } });
    expect(attempt?.currentQuestionNumber).toBe(1);
  });

  it("right answer -> correct:true, matchType, keyNote, correctAnswer", async () => {
    const created = await createAttempt(postRequest({ redo: true }), {
      params: Promise.resolve({ id: exerciseId }),
    });
    const { attemptId } = await created.json();

    const res = await submitAnswer(postRequest({ questionId: q1Id, answerText: "cooks" }), {
      params: Promise.resolve({ id: attemptId }),
    });
    const json = await res.json();

    expect(json.correct).toBe(true);
    expect(json.matchType).toBe("EXACT");
    expect(json.keyNote).toBe("simple present, 3rd person singular");
    expect(json.correctAnswer).toBe("cooks");
    expect(json.explanation).toBeNull();
    expect(json.completedLesson).toBeUndefined();

    const attempt = await db.exerciseAttempt.findUnique({ where: { id: attemptId } });
    expect(attempt?.currentQuestionNumber).toBe(2); // advanced past q1
    expect(attempt?.completedAt).toBeNull(); // q2 still outstanding
  });

  it(
    "answering the final question correctly sets completedAt AND, in one transaction, " +
      "upserts LessonProgress COMPLETED for this lesson + UNLOCKED for the next lesson",
    async () => {
      const created = await createAttempt(postRequest({ redo: true }), {
        params: Promise.resolve({ id: exerciseId }),
      });
      const { attemptId } = await created.json();

      await submitAnswer(postRequest({ questionId: q1Id, answerText: "cooks" }), {
        params: Promise.resolve({ id: attemptId }),
      });
      const finalRes = await submitAnswer(postRequest({ questionId: q2Id, answerText: "freezes" }), {
        params: Promise.resolve({ id: attemptId }),
      });
      const finalJson = await finalRes.json();

      expect(finalJson.correct).toBe(true);
      expect(finalJson.completedLesson).toEqual({ nextLessonSlug: `test_lesson_b_${RUN_ID}` });

      const attempt = await db.exerciseAttempt.findUnique({ where: { id: attemptId } });
      expect(attempt?.completedAt).not.toBeNull();

      // The dual-transaction assertion: BOTH rows exist after completion.
      // (The route handler writes both via a single `db.$transaction(...)`
      // alongside the AttemptAnswer/ExerciseAttempt updates — see
      // `src/app/api/attempts/[id]/answers/route.ts`.)
      const progressRows = await db.lessonProgress.findMany({
        where: { userId, lessonId: { in: [lessonAId, lessonBId] } },
      });
      const byLesson = new Map(progressRows.map((r) => [r.lessonId, r]));

      expect(byLesson.get(lessonAId)?.status).toBe("COMPLETED");
      expect(byLesson.get(lessonAId)?.completedAt).not.toBeNull();
      expect(byLesson.get(lessonBId)?.status).toBe("UNLOCKED");
    },
  );

  it("redo:true creates a new attempt while the old attempt's rows remain", async () => {
    const first = await createAttempt(postRequest({ redo: true }), {
      params: Promise.resolve({ id: exerciseId }),
    });
    const { attemptId: oldAttemptId } = await first.json();

    await submitAnswer(postRequest({ questionId: q1Id, answerText: "cooks" }), {
      params: Promise.resolve({ id: oldAttemptId }),
    });

    const second = await createAttempt(postRequest({ redo: true }), {
      params: Promise.resolve({ id: exerciseId }),
    });
    const { attemptId: newAttemptId, currentQuestionNumber } = await second.json();

    expect(newAttemptId).not.toBe(oldAttemptId);
    expect(currentQuestionNumber).toBe(1);

    const oldAnswers = await db.attemptAnswer.findMany({ where: { attemptId: oldAttemptId } });
    expect(oldAnswers).toHaveLength(1); // untouched by the redo

    const newAnswers = await db.attemptAnswer.findMany({ where: { attemptId: newAttemptId } });
    expect(newAnswers).toHaveLength(0); // fresh attempt starts clean
  });
});
