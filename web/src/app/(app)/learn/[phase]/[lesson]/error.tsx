"use client";

import NextLink from "next/link";
import { useEffect } from "react";

import { ErrorState } from "@/components/ErrorState";

/** Error boundary for the lecture reader (`/learn/[phase]/[lesson]`, Task 7)
 * and, since it's the nearest boundary above them, also covers the
 * `vocab/*` flashcard and game sub-routes unless they get their own. */
export default function LessonError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Không thể tải bài học"
      description="Rất tiếc, có gì đó không ổn khi tải nội dung bài học này. Vui lòng thử lại."
      reset={reset}
      linkComponent={NextLink}
    />
  );
}
