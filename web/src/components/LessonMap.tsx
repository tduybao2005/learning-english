import Link from "next/link";

import { cn } from "@/lib/utils";
import type { LessonState } from "@/lib/progress";

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

const STATE_META: Record<
  LessonState,
  { icon: string; className: string; clickable: boolean }
> = {
  COMPLETED: {
    icon: "✓",
    className:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    clickable: true,
  },
  UNLOCKED: {
    icon: "▶",
    className: "border-primary bg-primary text-primary-foreground",
    clickable: true,
  },
  SKIPPED: {
    icon: "⏭",
    className:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    clickable: true,
  },
  LOCKED: {
    icon: "🔒",
    className:
      "border-border bg-muted text-muted-foreground cursor-not-allowed opacity-70",
    clickable: false,
  },
};

function LessonPill({
  phaseSlug,
  lesson,
  state,
}: {
  phaseSlug: string;
  lesson: LessonMapLesson;
  state: LessonState;
}) {
  const meta = STATE_META[state];
  const label = `${meta.icon} Bài ${lesson.orderIndex}`;

  if (!meta.clickable) {
    return (
      <span
        className={cn(
          "inline-flex select-none items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
          meta.className,
        )}
        title="Hoàn thành bài trước để mở khóa"
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={`/learn/${phaseSlug}/${lesson.slug}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:opacity-80",
        meta.className,
      )}
      title={lesson.title}
    >
      {label}
    </Link>
  );
}

/** Vertical phase timeline: each phase is a card with a progress bar and a wrapping row of lesson pills. */
export function LessonMap({
  phases,
  states,
}: {
  phases: LessonMapPhase[];
  states: Map<string, LessonState>;
}) {
  return (
    <div className="relative space-y-8 pl-6">
      <div aria-hidden className="absolute top-2 bottom-2 left-[7px] w-px bg-border" />
      {phases.map((phase) => {
        const doneCount = phase.lessons.filter((lesson) => {
          const state = states.get(lesson.id);
          return state === "COMPLETED" || state === "SKIPPED";
        }).length;
        const total = phase.lessons.length;
        const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

        return (
          <div key={phase.id} className="relative">
            <div
              aria-hidden
              className="absolute -left-6 top-1.5 size-3.5 rounded-full border-2 border-background bg-primary"
            />
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">{phase.title}</h2>
                <span className="text-xs text-muted-foreground">{phase.cefrLabel}</span>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {doneCount}/{total} bài
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {phase.lessons.map((lesson) => (
                  <LessonPill
                    key={lesson.id}
                    phaseSlug={phase.slug}
                    lesson={lesson}
                    state={states.get(lesson.id) ?? "LOCKED"}
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
