"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function OnboardingNamePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Vui lòng nhập tên của bạn.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/profile/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      router.push("/onboarding/path");
    } catch {
      setError("Không thể lưu tên. Vui lòng thử lại.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-8 lg:max-w-3xl">
      <div className="mb-8 h-1.5 w-full rounded-full bg-muted">
        <div className="h-full w-1/3 rounded-full bg-primary" />
      </div>

      <h1 className="text-h1 font-extrabold">Bạn tên là gì?</h1>
      <p className="mt-2 text-body text-muted-foreground">
        Tên của bạn sẽ hiển thị trong ứng dụng thay cho địa chỉ email.
      </p>

      <input
        type="text"
        value={name}
        maxLength={50}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="Tên hiển thị của bạn"
        className="mt-6 w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div className="mt-8 flex flex-col gap-2">
        <Button type="button" className="w-full" disabled={isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? "Đang lưu..." : "Tiếp tục"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => router.push("/onboarding/path")}>
          Bỏ qua
        </Button>
      </div>
    </div>
  );
}
