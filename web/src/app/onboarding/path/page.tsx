"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const IELTS_BANDS = ["5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0"] as const;

const CEFR_LEVELS = [
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

type GoalTab = "IELTS" | "CEFR";

export default function OnboardingPathPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<GoalTab>("IELTS");
  const [ieltsBand, setIeltsBand] = useState<string | null>(null);
  const [cefrLevel, setCefrLevel] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedValue = activeTab === "IELTS" ? ieltsBand : cefrLevel;

  async function handleSubmit() {
    if (!selectedValue) {
      setError(
        activeTab === "IELTS"
          ? "Vui lòng chọn mục tiêu band điểm IELTS."
          : "Vui lòng chọn cấp độ CEFR.",
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalType: activeTab, goalValue: selectedValue }),
      });

      if (!res.ok) {
        setError("Không thể lưu lựa chọn. Vui lòng thử lại.");
        setIsSubmitting(false);
        return;
      }

      router.push("/onboarding/placement");
    } catch {
      setError("Không thể lưu lựa chọn. Vui lòng thử lại.");
      setIsSubmitting(false);
    }
  }

  function handleSkip() {
    router.push("/dashboard?prompt=placement");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Chọn mục tiêu học tập</CardTitle>
          <CardDescription>
            Chọn mục tiêu để chúng tôi cá nhân hoá lộ trình học của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as GoalTab)}
          >
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
                    aria-checked={ieltsBand === band}
                    onClick={() => setIeltsBand(band)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                      ieltsBand === band
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
                    aria-checked={cefrLevel === level.value}
                    onClick={() => setCefrLevel(level.value)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      cefrLevel === level.value
                        ? "border-primary bg-primary/5"
                        : "border-input bg-background hover:bg-muted",
                    )}
                  >
                    <div className="font-semibold">{level.value}</div>
                    <div className="text-sm text-muted-foreground">
                      {level.description}
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Đang lưu..." : "Tiếp tục"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={handleSkip}>
            Bỏ qua
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
