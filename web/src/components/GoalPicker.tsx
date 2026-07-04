"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const IELTS_BANDS = ["5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0"] as const;

export const CEFR_LEVELS = [
  {
    value: "A1",
    description: "Mới bắt đầu — hiểu và dùng được các cụm từ quen thuộc hằng ngày.",
  },
  {
    value: "A2",
    description: "Sơ cấp — giao tiếp được trong các tình huống đơn giản, quen thuộc.",
  },
  {
    value: "B1",
    description: "Trung cấp — xử lý được hầu hết tình huống khi đi du lịch hoặc làm việc.",
  },
  {
    value: "B2",
    description: "Trung cấp cao — trao đổi trôi chảy, tự nhiên với người bản ngữ.",
  },
  {
    value: "C1",
    description: "Cao cấp — sử dụng ngôn ngữ linh hoạt, hiệu quả cho mục đích học thuật.",
  },
] as const;

export type GoalTab = "IELTS" | "CEFR";

export type GoalPickerValue = { goalType: GoalTab; goalValue: string };

/**
 * Shared IELTS/CEFR goal picker — the same radio-chip UI first built for
 * onboarding (Task 6), extracted so the settings page (Task 15) can reuse it
 * for "change goal" instead of re-implementing the tabs/chips from scratch.
 * Purely controlled: the host page owns the selected value and what happens
 * on submit (redirect vs. inline save confirmation).
 */
export function GoalPicker({
  value,
  onChange,
}: {
  value: GoalPickerValue | null;
  onChange: (value: GoalPickerValue) => void;
}) {
  const [activeTab, setActiveTab] = useState<GoalTab>(value?.goalType ?? "IELTS");

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as GoalTab)}>
      <TabsList className="w-full">
        <TabsTrigger value="IELTS" className="flex-1">
          Mục tiêu IELTS
        </TabsTrigger>
        <TabsTrigger value="CEFR" className="flex-1">
          Cấp độ CEFR
        </TabsTrigger>
      </TabsList>

      <TabsContent value="IELTS" className="mt-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Chọn band điểm IELTS bạn muốn đạt được:
        </p>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {IELTS_BANDS.map((band) => (
            <button
              key={band}
              type="button"
              role="radio"
              aria-checked={value?.goalType === "IELTS" && value.goalValue === band}
              onClick={() => onChange({ goalType: "IELTS", goalValue: band })}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                value?.goalType === "IELTS" && value.goalValue === band
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground hover:bg-muted",
              )}
            >
              {band}
            </button>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="CEFR" className="mt-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Chọn cấp độ CEFR phù hợp với bạn:
        </p>
        <div role="radiogroup" className="flex flex-col gap-2">
          {CEFR_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={value?.goalType === "CEFR" && value.goalValue === level.value}
              onClick={() => onChange({ goalType: "CEFR", goalValue: level.value })}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                value?.goalType === "CEFR" && value.goalValue === level.value
                  ? "border-primary bg-primary/5"
                  : "border-input bg-background hover:bg-muted",
              )}
            >
              <div className="font-semibold">{level.value}</div>
              <div className="text-sm text-muted-foreground">{level.description}</div>
            </button>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
