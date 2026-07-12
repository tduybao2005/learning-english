"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ResetToStartButton } from "@/components/ResetToStartButton";

/** Router-aware wrapper around the presentational `ResetToStartButton`.
 *
 * Posts to `POST /api/placement/reset-to-start` (which clears the SKIPPED
 * rows placement had written and unlocks lesson 1), then pushes to the
 * dashboard. `User.placementBand` and the stored `PlacementAttempt` are
 * untouched — only the chosen starting lesson changes. */
export function ResetToStartButtonConnected() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/placement/reset-to-start", { method: "POST" });
      if (!res.ok) throw new Error("reset failed");
      router.push("/dashboard");
    } catch {
      setError("Không thể đổi điểm bắt đầu. Vui lòng thử lại.");
      setLoading(false);
    }
  }

  return <ResetToStartButton onReset={handleReset} pending={loading} error={error} />;
}
