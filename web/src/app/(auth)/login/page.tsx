"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Vui lòng nhập địa chỉ email.");
      return;
    }

    setIsSubmitting(true);
    try {
      await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      router.push(`/login/verify?email=${encodeURIComponent(trimmed)}`);
    } catch {
      setError("Không thể gửi mã. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-primary-glow">
        H
      </div>
      <h1 className="text-h1 font-extrabold">Chào mừng trở lại 👋</h1>
      <p className="mt-2 text-body text-muted-foreground">
        Nhập email của bạn, chúng tôi sẽ gửi một mã đăng nhập gồm 6 chữ số.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          placeholder="ban@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
          {isSubmitting ? "Đang gửi..." : "Gửi mã đăng nhập"}
        </Button>
      </form>
    </div>
  );
}
