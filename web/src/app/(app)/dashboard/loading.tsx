import { Skeleton } from "@/components/ui/skeleton";

/** Streamed while `DashboardPage` awaits `db.phase.findMany` + `getLessonStates`
 * (Task 7). Mirrors `LessonMap`'s shape: a title, then one card per phase with
 * a progress bar and a row of lesson pills. */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Skeleton className="mb-2 h-8 w-64" />
      <Skeleton className="mb-6 h-4 w-80" />

      <div className="relative space-y-8 pl-6">
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
  );
}
