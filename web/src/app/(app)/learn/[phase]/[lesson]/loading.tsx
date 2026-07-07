import { Skeleton } from "@/components/ui/skeleton";

/** Streamed while `LecturePage` awaits the `db.lesson.findFirst` +
 * `getLessonStates` lookup (Task 7). Mirrors the lecture page's shape: back
 * link, phase label, title, the Bài giảng/Từ vựng/Bài tập tab row, then
 * paragraph-shaped blocks standing in for the markdown lecture body. */
export default function LectureLoading() {
  return (
    <div className="mx-auto max-w-3xl lg:max-w-5xl px-4 py-8 lg:grid lg:grid-cols-[minmax(0,680px)_220px] lg:justify-center lg:gap-10">
      <div>
        <Skeleton className="mb-4 h-4 w-40" />
        <Skeleton className="mb-2 h-4 w-32" />
        <Skeleton className="mb-4 h-7 w-72" />

        <div className="mb-6 flex gap-4 border-b border-border pb-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      <div className="hidden lg:flex lg:flex-col lg:gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}
