"use client";

import NextLink from "next/link";
import { useEffect } from "react";

import { ErrorState } from "@/components/ErrorState";

/** Error boundary for the exercise runner (Task 9). Deliberately does not
 * reset any in-progress attempt state itself — `reset()` just re-renders the
 * segment, and the runner re-fetches attempt/question state from the DB on
 * mount, so retry progress already saved server-side is not lost. */
export default function ExerciseError({
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
      title="Không thể tải bài tập"
      description="Rất tiếc, có gì đó không ổn khi tải bài tập này. Tiến độ đã lưu của bạn không bị mất — vui lòng thử lại."
      reset={reset}
      linkComponent={NextLink}
    />
  );
}
