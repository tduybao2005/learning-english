import { Skeleton } from "@/components/ui/skeleton";

/** Streamed while `SettingsPage` awaits the user + latest placement attempt
 * lookups (Task 14). Mirrors the settings page's shape: a heading, the
 * profile hero card, then a stack of action-row skeletons standing in for
 * the goal/redo-placement/theme/logout rows. */
export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Skeleton className="mb-1 h-8 w-32" />
      <Skeleton className="mb-6 h-4 w-72" />

      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-2xl" />

        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
