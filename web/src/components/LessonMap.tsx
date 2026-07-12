import { cn } from "@/lib/utils";
import type { LessonState } from "@/lib/progress";
import { PhasePillRow } from "@/components/PhasePillRow";

export type LessonMapLesson = {
  id: string;
  slug: string;
  title: string;
  orderIndex: number;
};

export type LessonMapPhase = {
  id: string;
  slug: string;
  title: string;
  cefrLabel: string;
  orderIndex: number;
  lessons: LessonMapLesson[];
};

/** Compact phase-row list (design doc restyle): each phase renders as one
 * of three row variants instead of always expanding every lesson —
 * completed and locked phases collapse to a single summary row, while the
 * active phase gets a progress bar and a small window of lesson pills
 * centered on the learner's current position. */
export function LessonMap({
  phases,
  states,
  linkComponent,
}: {
  phases: LessonMapPhase[];
  states: Map<string, LessonState>;
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-4">
      {phases.map((phase) => {
        const doneCount = phase.lessons.filter((lesson) => {
          const state = states.get(lesson.id);
          return state === "COMPLETED" || state === "SKIPPED";
        }).length;
        const total = phase.lessons.length;
        const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);
        const isActive = phase.lessons.some((l) => states.get(l.id) === "UNLOCKED");
        const isCompleted = total > 0 && doneCount === total;

        if (isCompleted) {
          return (
            <div
              key={phase.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-xs font-bold text-success-foreground"
              >
                ✓
              </span>
              <h2 className="flex-1 font-bold">
                GĐ {phase.orderIndex} · {phase.title}
              </h2>
              <span className="shrink-0 font-bold text-success">
                {doneCount}/{total}
              </span>
            </div>
          );
        }

        if (!isActive) {
          return (
            <div
              key={phase.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 opacity-70"
            >
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold"
              >
                🔒
              </span>
              <h2 className="flex-1 font-bold">
                GĐ {phase.orderIndex} · {phase.title}
              </h2>
              <span className="shrink-0 font-bold text-muted-foreground">
                {doneCount}/{total}
              </span>
            </div>
          );
        }

        return (
          <div
            key={phase.id}
            className={cn(
              "rounded-xl border p-4",
              "border-primary bg-primary/5 shadow-primary-glow",
            )}
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="font-bold">
                GĐ {phase.orderIndex} · {phase.title}
              </h2>
              <span className="shrink-0 text-primary font-bold">
                {doneCount}/{total}
              </span>
            </div>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary animate-progress-fill"
                style={{ width: `${percent}%` }}
              />
            </div>
            <PhasePillRow
              total={total}
              linkComponent={linkComponent}
              lessons={phase.lessons.map((lesson) => ({
                id: lesson.id,
                orderIndex: lesson.orderIndex,
                title: lesson.title,
                state: states.get(lesson.id) ?? "LOCKED",
                href: `/learn/${phase.slug}/${lesson.slug}`,
              }))}
            />
          </div>
        );
      })}
    </div>
  );
}
