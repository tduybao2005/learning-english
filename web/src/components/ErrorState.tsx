"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Shared body for the App Router `error.tsx` boundaries (Task 15 polish
 * pass). Next.js requires each `error.tsx` to be its own Client Component
 * exporting a default function that receives `{ error, reset }`, so the
 * per-route files stay as thin wrappers around this — one place to keep the
 * Vietnamese copy and layout consistent. Visually mirrors `EmptyState`'s
 * composition (icon tile, headline, description) but keeps its own
 * button-based retry action since `reset()` needs a click handler, not a
 * `<Link>`.
 */
export function ErrorState({
  title = "Đã có lỗi xảy ra",
  description = "Rất tiếc, có gì đó không ổn khi tải trang này. Bạn có thể thử lại hoặc quay về trang chủ.",
  reset,
}: {
  title?: string;
  description?: string;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span aria-hidden className="flex size-24 items-center justify-center rounded-3xl bg-destructive-bg text-5xl">
        ⚠️
      </span>
      <h2 className="text-h2 font-extrabold">{title}</h2>
      <p className="max-w-xs text-body text-muted-foreground">{description}</p>
      <div className="mt-2 flex items-center gap-3">
        <Button type="button" variant="outline" onClick={reset}>
          Thử lại
        </Button>
        <Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
