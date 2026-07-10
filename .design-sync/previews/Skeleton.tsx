import { Skeleton } from "web";

export const LessonListLoading = () => (
  <div className="w-80 space-y-4">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

export const CardLoading = () => (
  <div className="w-72 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
    <Skeleton className="h-5 w-2/3" />
    <Skeleton className="h-3 w-1/3" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-9 w-28 rounded-lg" />
  </div>
);

export const Shapes = () => (
  <div className="flex items-center gap-4">
    <Skeleton className="size-12 rounded-full" />
    <Skeleton className="size-12 rounded-lg" />
    <Skeleton className="h-12 w-40" />
  </div>
);
