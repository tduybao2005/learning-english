// web/src/components/lesson-node.tsx
// Node bài học dùng chung — 4 trạng thái: done / unlocked / locked / skipped
"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

export type LessonStatus = "done" | "unlocked" | "locked" | "skipped"

const ICON: Record<LessonStatus, string> = {
  done: "✓", unlocked: "▶", locked: "🔒", skipped: "⏭",
}

export function LessonNode({
  label, status, onClick, className,
}: {
  label: string
  status: LessonStatus
  onClick?: () => void
  className?: string
}) {
  const base =
    "inline-flex items-center gap-2.5 rounded-full px-4 py-3 text-sm font-semibold transition-all select-none"

  const byStatus: Record<LessonStatus, string> = {
    done: "bg-success-bg text-success border border-success/40",
    unlocked:
      "bg-primary text-primary-foreground shadow-[0_6px_18px_--theme(--color-primary/30%)] hover:brightness-105 active:scale-[.98] cursor-pointer",
    locked: "bg-muted text-muted-foreground border border-border cursor-not-allowed",
    skipped: "bg-card text-muted-foreground border border-dashed border-border",
  }

  const badge: Record<LessonStatus, string> = {
    done: "bg-success text-success-foreground",
    unlocked: "bg-primary-foreground text-primary",
    locked: "bg-transparent",
    skipped: "bg-muted",
  }

  return (
    <button
      type="button"
      disabled={status === "locked"}
      onClick={status === "unlocked" ? onClick : undefined}
      className={cn(base, byStatus[status], className)}
      aria-label={`${label} — ${status}`}
    >
      <span
        className={cn(
          "grid size-[18px] place-items-center rounded-full text-[10px] font-extrabold",
          badge[status]
        )}
      >
        {ICON[status]}
      </span>
      {label}
    </button>
  )
}
