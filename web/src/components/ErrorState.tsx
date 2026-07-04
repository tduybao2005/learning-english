"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shared body for the App Router `error.tsx` boundaries (Task 15 polish
 * pass). Next.js requires each `error.tsx` to be its own Client Component
 * exporting a default function that receives `{ error, reset }`, so the
 * per-route files stay as thin wrappers around this — one place to keep the
 * Vietnamese copy and layout consistent.
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
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-2 flex items-center gap-3">
        <Button type="button" onClick={reset}>
          Thử lại
        </Button>
        <Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
