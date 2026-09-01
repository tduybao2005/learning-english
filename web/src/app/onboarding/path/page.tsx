"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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

      // Bài kiểm tra đầu vào đã được ẩn: lộ trình không còn khoá bài nên
      // không có gì để nó mở khoá nữa. Vào thẳng nơi có bài học.
      router.push("/learn");
    } catch {
      setError("Không thể lưu lựa chọn. Vui lòng thử lại.");
      setIsSubmitting(false);
    }
  }

  function handleSkip() {
    router.push("/learn");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-8 lg:max-w-3xl">
      <div className="mb-8 h-1.5 w-full rounded-full bg-muted">
        <div className="h-full w-2/3 rounded-full bg-primary" />
      </div>

      <h1 className="text-h1 font-extrabold lg:text-display">Mục tiêu của bạn?</h1>
      <p className="mt-2 text-body text-muted-foreground">
        Chọn mục tiêu để chúng tôi cá nhân hoá lộ trình học của bạn.
      </p>

      <div className="mt-6">
        <GoalPicker value={selected} onChange={setSelected} />
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="mt-8 flex flex-col gap-2">
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
      </div>
    </div>
  );
}
