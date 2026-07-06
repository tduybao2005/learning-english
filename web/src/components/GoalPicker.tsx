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
      <TabsList className="w-full rounded-full bg-muted p-1">
        <TabsTrigger value="IELTS" className="flex-1 rounded-full font-bold data-active:bg-card data-active:shadow-sm">
          Mục tiêu IELTS
        </TabsTrigger>
        <TabsTrigger value="CEFR" className="flex-1 rounded-full font-bold data-active:bg-card data-active:shadow-sm">
          Cấp độ CEFR
        </TabsTrigger>
      </TabsList>

      <TabsContent value="IELTS" className="mt-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Chọn band điểm IELTS bạn muốn đạt được:
        </p>
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {IELTS_BANDS.map((band) => {
            const selected = value?.goalType === "IELTS" && value.goalValue === band;
            return (
              <button
                key={band}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ goalType: "IELTS", goalValue: band })}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-2xl border bg-card text-h2 font-bold transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-primary-glow"
                    : "border-input hover:bg-muted",
                )}
              >
                {band}
                {band === "6.5" ? (
                  <span
                    className={cn(
                      "text-caption font-medium",
                      selected ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    Phổ biến
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="CEFR" className="mt-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Chọn cấp độ CEFR phù hợp với bạn:
        </p>
        <div role="radiogroup" className="flex flex-col gap-2">
          {CEFR_LEVELS.map((level) => {
            const selected = value?.goalType === "CEFR" && value.goalValue === level.value;
            return (
              <button
                key={level.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ goalType: "CEFR", goalValue: level.value })}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  selected
                    ? "border-primary bg-secondary/60"
                    : "border-input bg-background hover:bg-muted",
                )}
              >
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg font-bold",
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {level.value}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{level.value}</div>
                  <div className="text-sm text-muted-foreground">{level.description}</div>
                </div>
                {selected ? <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" /> : null}
              </button>
            );
          })}
        </div>
      </TabsContent>
    </Tabs>
  );
}
