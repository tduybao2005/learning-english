"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { GoalPicker, type GoalPickerValue } from "@/components/GoalPicker";

/**
 * "Change goal" form for the settings page. Reuses `GoalPicker` (the same
 * IELTS/CEFR chip UI from onboarding) and posts to the existing
 * `POST /api/onboarding/path` route (Task 6) — that route already does
 * exactly what's needed here (zod-validated discriminated union, then
 * `db.user.update({ goalType, goalValue })`), so there is no new API route
 * for this. Unlike onboarding, saving here does not redirect — it shows an
 * inline confirmation and refreshes the server-rendered goal display above.
 */
export function SettingsGoalForm({
  initialGoalType,
  initialGoalValue,
}: {
  initialGoalType: "IELTS" | "CEFR" | null;
  initialGoalValue: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<GoalPickerValue | null>(
    initialGoalType && initialGoalValue
      ? { goalType: initialGoalType, goalValue: initialGoalValue }
      : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  async function handleSave() {
    if (!selected) {
      setStatus("error");
      return;
    }

    setIsSubmitting(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/onboarding/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <GoalPicker value={selected} onChange={setSelected} />

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" disabled={isSubmitting} onClick={handleSave}>
          {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
        {status === "saved" ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Đã cập nhật mục tiêu học tập.
          </p>
        ) : null}
        {status === "error" ? (
          <p className="text-sm text-destructive">Không thể lưu thay đổi. Vui lòng thử lại.</p>
        ) : null}
      </div>
    </div>
  );
}
