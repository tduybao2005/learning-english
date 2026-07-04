import { describe, it, expect, beforeEach, vi } from "vitest";

// ---- In-memory fake Prisma client (mocks `db` from Task 2) ----
type PhaseRow = { id: string; orderIndex: number };
type LessonRow = { id: string; phaseId: string; orderIndex: number; title: string };
type ProgressRow = { userId: string; lessonId: string; status: "UNLOCKED" | "COMPLETED" | "SKIPPED" };

// Fixture: 2 phases, 3 + 2 lessons (a subset shaped like the real 5-phase/52-lesson
// curriculum — enough to exercise cross-phase `getNextLesson` without needing a DB).
const phases: PhaseRow[] = [
  { id: "phase_1", orderIndex: 0 },
  { id: "phase_2", orderIndex: 1 },
];

const lessons: LessonRow[] = [
  { id: "p1l1", phaseId: "phase_1", orderIndex: 0, title: "P1L1" },
  { id: "p1l2", phaseId: "phase_1", orderIndex: 1, title: "P1L2" },
  { id: "p1l3", phaseId: "phase_1", orderIndex: 2, title: "P1L3" },
  { id: "p2l1", phaseId: "phase_2", orderIndex: 0, title: "P2L1" },
  { id: "p2l2", phaseId: "phase_2", orderIndex: 1, title: "P2L2" },
];

let progressRows: ProgressRow[] = [];

function globalOrder(a: LessonRow, b: LessonRow) {
  const phaseA = phases.find((p) => p.id === a.phaseId)!;
  const phaseB = phases.find((p) => p.id === b.phaseId)!;
  if (phaseA.orderIndex !== phaseB.orderIndex) return phaseA.orderIndex - phaseB.orderIndex;
  return a.orderIndex - b.orderIndex;
}

const fakeDb = {
  lesson: {
    findMany: vi.fn(async () => [...lessons].sort(globalOrder)),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return lessons.find((l) => l.id === where.id) ?? null;
    }),
    findFirst: vi.fn(
      async ({
        where,
        orderBy,
      }: {
        where: { phaseId?: string; orderIndex?: { gt: number } };
        orderBy: { orderIndex: "asc" | "desc" };
      }) => {
        let candidates = lessons.filter((l) => {
          if (where.phaseId !== undefined && l.phaseId !== where.phaseId) return false;
          if (where.orderIndex?.gt !== undefined && !(l.orderIndex > where.orderIndex.gt)) return false;
          return true;
        });
        candidates = candidates.sort((a, b) =>
          orderBy.orderIndex === "asc" ? a.orderIndex - b.orderIndex : b.orderIndex - a.orderIndex,
        );
        return candidates[0] ?? null;
      },
    ),
  },
  phase: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return phases.find((p) => p.id === where.id) ?? null;
    }),
    findFirst: vi.fn(
      async ({
        where,
        orderBy,
      }: {
        where: { orderIndex?: { gt: number } };
        orderBy: { orderIndex: "asc" | "desc" };
      }) => {
        let candidates = phases.filter((p) => {
          if (where.orderIndex?.gt !== undefined && !(p.orderIndex > where.orderIndex.gt)) return false;
          return true;
        });
        candidates = candidates.sort((a, b) =>
          orderBy.orderIndex === "asc" ? a.orderIndex - b.orderIndex : b.orderIndex - a.orderIndex,
        );
        return candidates[0] ?? null;
      },
    ),
  },
  lessonProgress: {
    findMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
      return progressRows.filter((r) => r.userId === where.userId);
    }),
  },
};

vi.mock("@/lib/db", () => ({ db: fakeDb }));

// Import after the mock is registered.
const { getLessonStates, getNextLesson } = await import("./progress");

beforeEach(() => {
  progressRows = [];
  vi.clearAllMocks();
});

describe("getLessonStates", () => {
  it("fresh user (no LessonProgress rows) → exactly the globally-first lesson is UNLOCKED, rest LOCKED", async () => {
    const states = await getLessonStates("fresh-user");

    expect(states.get("p1l1")).toBe("UNLOCKED");
    expect(states.get("p1l2")).toBe("LOCKED");
    expect(states.get("p1l3")).toBe("LOCKED");
    expect(states.get("p2l1")).toBe("LOCKED");
    expect(states.get("p2l2")).toBe("LOCKED");
  });

  it("user with P1L1 COMPLETED and P1L2 UNLOCKED rows → reflects those, rest LOCKED", async () => {
    progressRows = [
      { userId: "u1", lessonId: "p1l1", status: "COMPLETED" },
      { userId: "u1", lessonId: "p1l2", status: "UNLOCKED" },
    ];

    const states = await getLessonStates("u1");

    expect(states.get("p1l1")).toBe("COMPLETED");
    expect(states.get("p1l2")).toBe("UNLOCKED");
    expect(states.get("p1l3")).toBe("LOCKED");
    expect(states.get("p2l1")).toBe("LOCKED");
    expect(states.get("p2l2")).toBe("LOCKED");
  });

  it("does not treat the first lesson as UNLOCKED if it already has an explicit row (e.g. SKIPPED)", async () => {
    progressRows = [{ userId: "u2", lessonId: "p1l1", status: "SKIPPED" }];

    const states = await getLessonStates("u2");

    expect(states.get("p1l1")).toBe("SKIPPED");
    expect(states.get("p1l2")).toBe("LOCKED");
  });
});

describe("getNextLesson", () => {
  it("returns the next lesson by orderIndex within the same phase", async () => {
    const next = await getNextLesson("p1l1");
    expect(next?.id).toBe("p1l2");
  });

  it("last lesson of phase 1 → first lesson of phase 2", async () => {
    const next = await getNextLesson("p1l3");
    expect(next?.id).toBe("p2l1");
  });

  it("last lesson overall → null", async () => {
    const next = await getNextLesson("p2l2");
    expect(next).toBeNull();
  });

  it("unknown lessonId → null", async () => {
    const next = await getNextLesson("does-not-exist");
    expect(next).toBeNull();
  });
});
