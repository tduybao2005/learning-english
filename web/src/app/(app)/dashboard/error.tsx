"use client";

import NextLink from "next/link";
import { useEffect } from "react";

import { ErrorState } from "@/components/ErrorState";

/** Error boundary for `/dashboard` (Task 7's lesson map). */
export default function DashboardError({
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
      title="Không thể tải trang chủ"
      description="Rất tiếc, có gì đó không ổn khi tải lộ trình học của bạn. Vui lòng thử lại."
      reset={reset}
      linkComponent={NextLink}
    />
  );
}
