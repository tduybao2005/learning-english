import { Skeleton } from "@/components/ui/skeleton";

/** Streamed while `DashboardPage` awaits `db.phase.findMany` + `getLessonStates`
 * (Task 7). Mirrors the current 2-column dashboard shape (Task 6 restyle):
 * a greeting heading, then phase-card skeletons (header + progress bar + a
 * row of lesson pills) in the main column, plus a right-column block on
 * `lg:` standing in for the "Việc hôm nay" primary card and the "Tuần này"
 * stats card. */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6">
      <div className="max-w-3xl lg:max-w-none">
        <Skeleton className="mb-1 h-8 w-56" />
        <Skeleton className="mb-6 h-4 w-48" />

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="mb-3 h-1.5 w-full" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, j) => (
                  <Skeleton key={j} className="h-6 w-16 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:mt-0">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
