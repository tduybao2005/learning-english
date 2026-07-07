import { Skeleton } from "@/components/ui/skeleton";

/** Streamed while `ExercisePage` awaits the lesson/attempt/question lookups
 * (Task 9). Mirrors the runner's shape: back link, title, tab row, progress
 * bar, a question-prompt block and a few answer-option blocks. */
export default function ExerciseLoading() {
  return (
    <div className="mx-auto max-w-3xl lg:max-w-5xl px-4 py-8">
      <Skeleton className="mb-4 h-4 w-40" />
      <Skeleton className="mb-2 h-4 w-32" />
      <Skeleton className="mb-4 h-7 w-72" />

      <div className="mb-6 flex gap-4 border-b border-border pb-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
      </div>

      <Skeleton className="mb-4 h-2 w-full rounded-full" />

      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="mb-4 h-5 w-full" />
        <Skeleton className="mb-4 h-5 w-3/4" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
