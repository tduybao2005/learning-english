"use client";

import { useEffect, useRef, useState } from "react";

import type { LessonState } from "@/lib/progress";
import { LessonNode } from "@/components/lesson-node";

export type PillLesson = {
  id: string;
  orderIndex: number;
  title: string;
  state: LessonState;
  href: string;
};

/**
 * Active-phase lesson pills (design item 8): a horizontally scrolling row of
 * ALL lessons auto-centered on the current one, with a right-edge fade mask,
 * plus a toggle that expands to a wrapped grid for the full-phase overview.
 */
export function PhasePillRow({
  lessons,
  total,
  linkComponent,
}: {
  lessons: PillLesson[];
  total: number;
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: React.ElementType;
}) {
  const [showAll, setShowAll] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showAll) return;
    const scroller = scrollerRef.current;
    const current = currentRef.current;
    if (!scroller || !current) return;
    scroller.scrollLeft = current.offsetLeft - scroller.clientWidth / 2 + current.clientWidth / 2;
  }, [showAll]);

  const pills = lessons.map((lesson) => (
    <div
      key={lesson.id}
      ref={lesson.state === "UNLOCKED" ? currentRef : undefined}
      className="shrink-0"
    >
      <LessonNode
        state={lesson.state}
        label={`Bài ${lesson.orderIndex}`}
        title={lesson.title}
        href={lesson.href}
        linkComponent={linkComponent}
      />
    </div>
  ));

  return (
    <div>
      {showAll ? (
        <div className="flex flex-wrap gap-2">{pills}</div>
      ) : (
        <div
          ref={scrollerRef}
          className="relative flex gap-2 overflow-x-auto overscroll-x-contain pb-2"
        >
          {pills}
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowAll((v) => !v)}
        className="mt-3 min-h-11 text-sm font-semibold text-primary hover:underline"
      >
        {showAll ? "Thu gọn ▴" : `Xem tất cả ${total} bài ▾`}
      </button>
    </div>
  );
}
