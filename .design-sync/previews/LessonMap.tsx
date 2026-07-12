import { LessonMap } from "web";

type State = "LOCKED" | "UNLOCKED" | "COMPLETED" | "SKIPPED";

const phase = (n: number, title: string, cefrLabel: string, count: number) => ({
  id: `p${n}`,
  slug: `phase-${n}`,
  title,
  cefrLabel,
  orderIndex: n,
  lessons: Array.from({ length: count }, (_, i) => ({
    id: `p${n}-l${i + 1}`,
    slug: `lesson-${String(i + 1).padStart(2, "0")}`,
    title: `Bài ${i + 1}`,
    orderIndex: i + 1,
  })),
});

const phases = [
  phase(1, "Nền tảng", "A1-A2", 6),
  phase(2, "Giao tiếp hằng ngày", "A2-B1", 7),
  phase(3, "Học thuật", "B1-B2", 5),
];

// Phase 1 completed, phase 2 active (progress bar + pill row), phase 3 locked —
// the three row variants at once.
const states = new Map<string, State>([
  ...phases[0].lessons.map((l) => [l.id, "COMPLETED" as State] as const),
  ...phases[1].lessons.map(
    (l, i) => [l.id, (i < 2 ? "COMPLETED" : i === 2 ? "UNLOCKED" : "LOCKED") as State] as const,
  ),
  ...phases[2].lessons.map((l) => [l.id, "LOCKED" as State] as const),
]);

export const Default = () => (
  <div className="w-[40rem]">
    <LessonMap phases={phases} states={states} linkComponent="a" />
  </div>
);

// A brand-new learner: nothing done, only the very first lesson unlocked.
const freshStates = new Map<string, State>(
  phases.flatMap((p) => p.lessons.map((l) => [l.id, "LOCKED" as State] as [string, State])),
);
freshStates.set("p1-l1", "UNLOCKED");

export const FreshStart = () => (
  <div className="w-[40rem]">
    <LessonMap phases={phases} states={freshStates} linkComponent="a" />
  </div>
);
