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
import { GoalPicker, type GoalPickerValue } from "@/components/GoalPicker";

export default function OnboardingPathPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<GoalPickerValue | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selected) {
      setError("Vui lòng chọn một mục tiêu học tập.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
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
          <GoalPicker value={selected} onChange={setSelected} />
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
