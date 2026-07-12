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
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: { userId: string; lessonId?: { in: string[] } };
      }) => {
        return progressRows.filter(
          (r) =>
            r.userId === where.userId &&
            (where.lessonId?.in === undefined || where.lessonId.in.includes(r.lessonId)),
        );
      },
    ),
    deleteMany: vi.fn(
      async ({
        where,
      }: {
        where: { userId: string; status?: { in: ProgressRow["status"][] } };
      }) => {
        progressRows = progressRows.filter(
          (r) =>
            !(
              r.userId === where.userId &&
              (where.status?.in === undefined || where.status.in.includes(r.status))
            ),
        );
      },
    ),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { userId_lessonId: { userId: string; lessonId: string } };
        create: ProgressRow;
        update: Partial<ProgressRow>;
      }) => {
        const { userId, lessonId } = where.userId_lessonId;
        const existing = progressRows.find((r) => r.userId === userId && r.lessonId === lessonId);
        if (existing) {
          Object.assign(existing, update);
        } else {
          progressRows.push({ ...create });
        }
      },
    ),
  },
};

vi.mock("@/lib/db", () => ({ db: fakeDb }));

// Import after the mock is registered.
const { getLessonStates, getNextLesson, assignStartPoint } = await import("./progress");

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

describe("assignStartPoint", () => {
  it("clears a stale UNLOCKED row that sits AFTER a newly-earlier start point", async () => {
    // Lần trước placement mở phase_2/p2l1 (UNLOCKED) + skip phase_1.
    // Lần này xếp lại về lesson đầu tiên toàn cục (p1l1).
    progressRows = [
      { userId: "u1", lessonId: "p1l1", status: "SKIPPED" },
      { userId: "u1", lessonId: "p1l2", status: "SKIPPED" },
      { userId: "u1", lessonId: "p1l3", status: "SKIPPED" },
      { userId: "u1", lessonId: "p2l1", status: "UNLOCKED" },
    ];

    await assignStartPoint(fakeDb as never, "u1", "p1l1");

    // Không còn row lạc ở phase_2:
    expect(progressRows.find((r) => r.lessonId === "p2l1")).toBeUndefined();
    // Lesson đầu tiên = UNLOCKED:
    expect(progressRows.find((r) => r.lessonId === "p1l1")?.status).toBe("UNLOCKED");
  });

  it("never downgrades a COMPLETED lesson that sits after the start point", async () => {
    progressRows = [{ userId: "u1", lessonId: "p2l1", status: "COMPLETED" }];

    await assignStartPoint(fakeDb as never, "u1", "p1l1");

    expect(progressRows.find((r) => r.lessonId === "p2l1")?.status).toBe("COMPLETED");
  });

  it("marks every lesson before the start point SKIPPED and the start UNLOCKED", async () => {
    await assignStartPoint(fakeDb as never, "u1", "p2l1");

    expect(progressRows.find((r) => r.lessonId === "p1l1")?.status).toBe("SKIPPED");
    expect(progressRows.find((r) => r.lessonId === "p1l3")?.status).toBe("SKIPPED");
    expect(progressRows.find((r) => r.lessonId === "p2l1")?.status).toBe("UNLOCKED");
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
