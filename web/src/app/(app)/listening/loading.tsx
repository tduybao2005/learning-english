import { Skeleton } from "@/components/ui/skeleton";

/** Streamed while `ListeningHubPage` awaits `db.listeningSet.findMany`
 * (Task 12). Mirrors the hub's shape: a heading, then a stack of row-card
 * skeletons standing in for each listening set's icon tile + title + caption. */
export default function ListeningLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Skeleton className="mb-1 h-8 w-40" />
      <Skeleton className="mb-6 h-4 w-72" />

      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
