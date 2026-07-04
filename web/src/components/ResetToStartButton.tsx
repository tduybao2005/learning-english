"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * "Tôi muốn bắt đầu từ đầu" — overrides the placement-assigned start point
 * and instead unlocks the very first lesson of the whole curriculum
 * (`POST /api/placement/reset-to-start`), clearing the SKIPPED rows the
 * placement result had written. Does not change `User.placementBand` or
 * the stored `PlacementAttempt` — only the chosen starting lesson.
 */
export function ResetToStartButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
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

  return (
    <div className="flex flex-col items-center gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? "Đang xử lý..." : "Tôi muốn bắt đầu từ đầu"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
