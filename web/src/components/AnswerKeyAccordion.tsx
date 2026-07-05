"use client";

import { useState } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/MarkdownContent";

/**
 * Collapsed-by-default reveal for an IELTS test's answer key, following the
 * same button+chevron accordion shape as `ListeningSetView`'s transcript
 * reveal — except there's no completion gate here (self-study reference,
 * not unlocked by a runner), just a persistent warning so learners
 * self-regulate rather than peek before attempting the test.
 */
export function AnswerKeyAccordion({ answerKeyMd }: { answerKeyMd: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
      >
        <span>Xem đáp án</span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              Chỉ xem đáp án <strong>sau khi</strong> bạn đã tự làm bài — xem trước sẽ làm mất tác dụng
              luyện tập.
            </p>
          </div>
          {answerKeyMd.trim().length > 0 ? (
            <MarkdownContent content={answerKeyMd} />
          ) : (
            <p className="text-muted-foreground">Đề này chưa có đáp án.</p>
          )}
        </div>
      )}
    </div>
  );
}
