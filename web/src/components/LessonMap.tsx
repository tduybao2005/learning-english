import { cn } from "@/lib/utils";
import type { LessonState } from "@/lib/progress";
import { LessonNode } from "@/components/lesson-node";

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

/** Vertical phase timeline: each phase is a card with a progress bar and a wrapping row of lesson nodes. */
export function LessonMap({
  phases,
  states,
}: {
  phases: LessonMapPhase[];
  states: Map<string, LessonState>;
}) {
  return (
    <div className="relative space-y-8 pl-10">
      <div aria-hidden className="absolute top-2 bottom-2 left-[14px] w-0.5 bg-border" />
      {phases.map((phase) => {
        const doneCount = phase.lessons.filter((lesson) => {
          const state = states.get(lesson.id);
          return state === "COMPLETED" || state === "SKIPPED";
        }).length;
        const total = phase.lessons.length;
        const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);
        const isActive = phase.lessons.some((l) => states.get(l.id) === "UNLOCKED");
        const isCompleted = total > 0 && doneCount === total;

        return (
          <div key={phase.id} className="relative">
            <div
              aria-hidden
              className={cn(
                "absolute -left-10 top-1.5 flex size-7 items-center justify-center rounded-full text-xs font-bold",
                isCompleted
                  ? "bg-success text-success-foreground"
                  : isActive
                    ? "bg-primary ring-4 ring-primary/20"
                    : "bg-muted",
              )}
            >
              {isCompleted ? "✓" : !isActive ? "🔒" : null}
            </div>
            <div
              className={cn(
                "rounded-xl border p-4",
                isActive
                  ? "border-primary bg-primary/5 shadow-primary-glow"
                  : "border-border bg-card",
                !isActive && !isCompleted ? "opacity-70" : "",
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
                  className={cn(
                    "h-full rounded-full animate-progress-fill",
                    isCompleted ? "bg-success" : "bg-primary",
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {phase.lessons.map((lesson) => (
                  <LessonNode
                    key={lesson.id}
                    state={states.get(lesson.id) ?? "LOCKED"}
                    label={`Bài ${lesson.orderIndex}`}
                    title={lesson.title}
                    href={`/learn/${phase.slug}/${lesson.slug}`}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
