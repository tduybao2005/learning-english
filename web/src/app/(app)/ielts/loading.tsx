import { Skeleton } from "@/components/ui/skeleton";

/** Streamed while `IeltsHubPage` awaits `db.ieltsTest.findMany` (Task 13).
 * Mirrors the hub's shape: a heading, then the same
 * `grid grid-cols-4 gap-3 sm:grid-cols-6` of aspect-square test tiles. */
export default function IeltsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Skeleton className="mb-1 h-8 w-56" />
      <Skeleton className="mb-6 h-4 w-80" />

      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
