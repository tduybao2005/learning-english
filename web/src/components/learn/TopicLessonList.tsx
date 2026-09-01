"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import type { LessonStatus4, TopicLesson } from "@/lib/learn-topics";

type Filter = "all" | LessonStatus4;

const STATUS_META: Record<LessonStatus4, { label: string; dot: string; chip: string }> = {
  done: { label: "Đã học", dot: "bg-success", chip: "text-success" },
  learning: { label: "Đang học", dot: "bg-streak", chip: "text-streak-foreground" },
  skipped: { label: "Đã bỏ qua", dot: "bg-muted-foreground/60", chip: "text-muted-foreground" },
  new: { label: "Chưa học", dot: "bg-muted-foreground/30", chip: "text-muted-foreground" },
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "new", label: "Chưa học" },
  { value: "learning", label: "Đang học" },
  { value: "done", label: "Đã học" },
];

/**
 * Danh sách bài trong một chủ đề, kèm bộ lọc trạng thái.
 *
 * Không có ổ khoá: lộ trình theo chủ đề thì bài nào cũng vào được, chấm màu
 * chỉ cho biết đã học tới đâu. "Đã bỏ qua" là bài nằm trước điểm bài kiểm tra
 * đầu vào xếp cho bạn — vẫn học lại được, nên nó không tính vào tiến độ.
 *
 * Hàng lọc dùng lưới 4 cột chứ không phải hàng cuộn ngang: bốn nhãn tiếng
 * Việt kèm số đếm luôn tràn khỏi màn hình điện thoại.
 */
export function TopicLessonList({
  lessons,
  linkComponent: Link,
}: {
  lessons: TopicLesson[];
  /** Truyền `NextLink` trong app, `"a"` trong test/design. */
  linkComponent: React.ElementType;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const base: Record<Filter, number> = {
      all: lessons.length,
      done: 0,
      learning: 0,
      skipped: 0,
      new: 0,
    };
    for (const l of lessons) base[l.status] += 1;
    return base;
  }, [lessons]);

  const filtered = useMemo(
    () => lessons.filter((l) => filter === "all" || l.status === filter),
    [lessons, filter],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Danh sách bài</h2>
        <span className="text-caption text-muted-foreground">
          {filtered.length}
          {filtered.length !== lessons.length && `/${lessons.length}`} bài
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            data-testid="lesson-filter"
            onClick={() => setFilter(f.value)}
            className={cn(
              "flex min-h-9 items-center justify-center rounded-full border px-1 text-center text-[11px] font-semibold leading-tight transition-all",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {f.label} {counts[f.value]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-caption text-muted-foreground">
          Chưa có bài nào ở trạng thái này.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {filtered.map((l) => {
            const meta = STATUS_META[l.status];
            return (
              <li key={l.id}>
                <Link
                  href={l.href}
                  data-testid="topic-lesson"
                  className="flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12"
                >
                  <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.title}</p>
                    <p className="truncate text-caption text-muted-foreground">
                      {l.phaseTitle}
                      {l.wordCount > 0 && <> · {l.wordCount} từ vựng</>}
                    </p>
                  </div>
                  <span className={cn("shrink-0 text-[11px] font-semibold", meta.chip)}>
                    {meta.label}
                  </span>
                  <span className="shrink-0 text-muted-foreground" aria-hidden>
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
