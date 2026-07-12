"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SettingsGoalForm } from "@/components/SettingsGoalForm";
import { type GoalPickerValue } from "@/components/GoalPicker";

/** Router-aware wrapper around the presentational `SettingsGoalForm`.
 *
 * Posts to the existing `POST /api/onboarding/path` route (zod-validated
 * discriminated union → `db.user.update({ goalType, goalValue })`), so there
 * is no separate settings API. Unlike onboarding it does not redirect — it
 * shows an inline confirmation and `router.refresh()`es the server-rendered
 * goal display above the form. */
export function SettingsGoalFormConnected({
  initialGoalType,
  initialGoalValue,
}: {
  initialGoalType: "IELTS" | "CEFR" | "TOEIC" | null;
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
    <SettingsGoalForm
      value={selected}
      onChange={setSelected}
      onSubmit={handleSave}
      pending={isSubmitting}
      status={status}
    />
  );
}
