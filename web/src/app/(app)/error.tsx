"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ErrorState";

/** Catch-all error boundary for every `(app)` route that doesn't define a
 * more specific one (listening hub, IELTS browser, settings). Sits below
 * `AppLayout`'s `<AppHeader>`, so the nav stays usable even when a page
 * throws. See `ErrorState` for the shared body. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState reset={reset} />;
}
