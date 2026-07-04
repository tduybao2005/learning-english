import { describe, it, expect, beforeEach, vi } from "vitest";

// ---- In-memory fake Prisma client (mocks `db` from Task 2) ----
type VocabWordRow = { id: string; lessonId: string };
type VocabProgressRow = { userId: string; wordId: string; box: number; lastReviewedAt: Date };

const vocabWords: VocabWordRow[] = [
  { id: "w1", lessonId: "lesson_1" },
  { id: "w2", lessonId: "lesson_1" },
  { id: "w3", lessonId: "lesson_1" },
  { id: "w4", lessonId: "lesson_2" },
];

let progressRows: VocabProgressRow[] = [];

const fakeDb = {
  vocabWord: {
    count: vi.fn(async ({ where }: { where: { lessonId: string } }) => {
      return vocabWords.filter((w) => w.lessonId === where.lessonId).length;
    }),
  },
  vocabProgress: {
    count: vi.fn(
      async ({
        where,
      }: {
        where: { userId: string; box: { gte: number }; word: { lessonId: string } };
      }) => {
        const lessonWordIds = new Set(
          vocabWords.filter((w) => w.lessonId === where.word.lessonId).map((w) => w.id),
        );
        return progressRows.filter(
          (r) =>
            r.userId === where.userId &&
            r.box >= where.box.gte &&
            lessonWordIds.has(r.wordId),
        ).length;
      },
    ),
    findMany: vi.fn(async ({ where }: { where: { userId: string; wordId: { in: string[] } } }) => {
      return progressRows.filter(
        (r) => r.userId === where.userId && where.wordId.in.includes(r.wordId),
      );
    }),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { userId_wordId: { userId: string; wordId: string } };
        create: VocabProgressRow;
        update: Partial<VocabProgressRow>;
      }) => {
        const { userId, wordId } = where.userId_wordId;
        const existing = progressRows.find((r) => r.userId === userId && r.wordId === wordId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { ...create };
        progressRows.push(row);
        return row;
      },
    ),
  },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};

vi.mock("@/lib/db", () => ({ db: fakeDb }));

// Import after the mock is registered.
const { nextBox, getVocabStats, applyReviewResults } = await import("./vocab");

beforeEach(() => {
  progressRows = [];
  vi.clearAllMocks();
});

describe("nextBox", () => {
  it("correct answer advances the box by 1", () => {
    expect(nextBox(0, true)).toBe(1);
    expect(nextBox(2, true)).toBe(3);
  });

  it("correct answer at box 5 (max) stays at 5, never 6", () => {
    expect(nextBox(5, true)).toBe(5);
  });

  it("correct answer at box 4 advances to 5 (boundary)", () => {
    expect(nextBox(4, true)).toBe(5);
  });

  it("wrong answer resets box to 0", () => {
    expect(nextBox(3, false)).toBe(0);
    expect(nextBox(5, false)).toBe(0);
  });

  it("wrong answer at box 0 stays at 0, never negative", () => {
    expect(nextBox(0, false)).toBe(0);
  });
});

describe("getVocabStats", () => {
  it("counts total as all VocabWords in the lesson, learned as 0 with no progress rows", async () => {
    const stats = await getVocabStats("u1", "lesson_1");
    expect(stats).toEqual({ learned: 0, total: 3 });
  });

  it("learned counts box >= 3 (boundary: box=3 counts)", async () => {
    progressRows = [{ userId: "u1", wordId: "w1", box: 3, lastReviewedAt: new Date() }];
    const stats = await getVocabStats("u1", "lesson_1");
    expect(stats.learned).toBe(1);
  });

  it("learned excludes box=2 (boundary: just under threshold)", async () => {
    progressRows = [{ userId: "u1", wordId: "w1", box: 2, lastReviewedAt: new Date() }];
    const stats = await getVocabStats("u1", "lesson_1");
    expect(stats.learned).toBe(0);
  });

  it("only counts progress rows for words in the requested lesson", async () => {
    progressRows = [
      { userId: "u1", wordId: "w1", box: 5, lastReviewedAt: new Date() },
      { userId: "u1", wordId: "w4", box: 5, lastReviewedAt: new Date() }, // lesson_2
    ];
    const stats = await getVocabStats("u1", "lesson_1");
    expect(stats).toEqual({ learned: 1, total: 3 });
  });

  it("only counts progress rows for the requested user", async () => {
    progressRows = [{ userId: "other-user", wordId: "w1", box: 5, lastReviewedAt: new Date() }];
    const stats = await getVocabStats("u1", "lesson_1");
    expect(stats.learned).toBe(0);
  });

  it("a lesson with zero VocabWords returns {learned: 0, total: 0}", async () => {
    const stats = await getVocabStats("u1", "lesson_with_no_vocab");
    expect(stats).toEqual({ learned: 0, total: 0 });
  });
});

describe("applyReviewResults", () => {
  it("creates a new VocabProgress row at box 1 for a first-time correct review", async () => {
    await applyReviewResults("u1", [{ wordId: "w1", correct: true }]);
    const row = progressRows.find((r) => r.wordId === "w1" && r.userId === "u1");
    expect(row?.box).toBe(1);
  });

  it("creates a new VocabProgress row at box 0 for a first-time wrong review", async () => {
    await applyReviewResults("u1", [{ wordId: "w1", correct: false }]);
    const row = progressRows.find((r) => r.wordId === "w1" && r.userId === "u1");
    expect(row?.box).toBe(0);
  });

  it("advances an existing box on correct, capped at 5", async () => {
    progressRows = [{ userId: "u1", wordId: "w1", box: 5, lastReviewedAt: new Date(0) }];
    await applyReviewResults("u1", [{ wordId: "w1", correct: true }]);
    expect(progressRows[0].box).toBe(5);
  });

  it("resets an existing box to 0 on wrong", async () => {
    progressRows = [{ userId: "u1", wordId: "w1", box: 4, lastReviewedAt: new Date(0) }];
    await applyReviewResults("u1", [{ wordId: "w1", correct: false }]);
    expect(progressRows[0].box).toBe(0);
  });

  it("applies a batch of mixed results independently per word", async () => {
    progressRows = [
      { userId: "u1", wordId: "w1", box: 2, lastReviewedAt: new Date(0) },
      { userId: "u1", wordId: "w2", box: 4, lastReviewedAt: new Date(0) },
    ];
    await applyReviewResults("u1", [
      { wordId: "w1", correct: true },
      { wordId: "w2", correct: false },
      { wordId: "w3", correct: true },
    ]);

    expect(progressRows.find((r) => r.wordId === "w1")?.box).toBe(3);
    expect(progressRows.find((r) => r.wordId === "w2")?.box).toBe(0);
    expect(progressRows.find((r) => r.wordId === "w3")?.box).toBe(1);
  });

  it("does nothing for an empty results array", async () => {
    await applyReviewResults("u1", []);
    expect(progressRows).toEqual([]);
  });
});
