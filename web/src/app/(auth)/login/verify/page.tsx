"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const RESEND_COOLDOWN_SECONDS = 60;

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email) {
      setError("Thiếu email. Vui lòng quay lại bước trước.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(errorMessage(data.reason));
        return;
      }

      router.push(data.needsOnboarding ? "/onboarding/path" : "/dashboard");
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email || cooldown > 0) return;
    setIsResending(true);
    setError(null);
    try {
      await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("Không thể gửi lại mã. Vui lòng thử lại.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Nhập mã xác nhận</CardTitle>
          <CardDescription>
            Chúng tôi đã gửi mã gồm 6 chữ số đến{" "}
            <span className="font-medium text-foreground">{email || "email của bạn"}</span>.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-3">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoFocus
              className="text-center text-lg tracking-[0.5em]"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || isResending}
              className="text-left text-sm text-muted-foreground underline-offset-4 disabled:no-underline disabled:opacity-50 enabled:hover:underline"
            >
              {cooldown > 0
                ? `Gửi lại mã sau ${cooldown}s`
                : isResending
                  ? "Đang gửi lại..."
                  : "Gửi lại mã"}
            </button>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting || code.length !== 6} className="w-full">
              {isSubmitting ? "Đang xác nhận..." : "Xác nhận"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function errorMessage(reason: string | undefined): string {
  switch (reason) {
    case "expired":
      return "Mã đã hết hạn. Vui lòng yêu cầu mã mới.";
    case "locked":
      return "Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.";
    case "rate_limited":
      return "Bạn vừa yêu cầu mã. Vui lòng thử lại sau ít phút.";
    case "invalid":
    default:
      return "Mã không đúng. Vui lòng thử lại.";
  }
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
