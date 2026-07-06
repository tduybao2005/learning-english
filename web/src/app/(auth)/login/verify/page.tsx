"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";

const RESEND_COOLDOWN_SECONDS = 60;
const OTP_LENGTH = 6;

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join("");
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

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <button
        type="button"
        onClick={() => router.push("/login")}
        className={buttonVariants({ variant: "secondary", size: "icon" })}
        aria-label="Quay lại"
      >
        ←
      </button>
      <h1 className="mt-6 text-h1 font-extrabold">Nhập mã 6 số</h1>
      <p className="mt-2 text-body text-muted-foreground">
        Chúng tôi đã gửi mã gồm 6 chữ số đến{" "}
        <span className="font-semibold text-foreground">{email || "email của bạn"}</span>.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
        <div className="flex justify-center gap-2">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleDigitKeyDown(index, e)}
              autoFocus={index === 0}
              className="size-12 rounded-xl border border-input bg-card text-center text-h2 font-bold outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          ))}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
          className="text-left text-sm text-muted-foreground underline-offset-4 disabled:no-underline disabled:opacity-50 enabled:hover:underline"
        >
          {cooldown > 0
            ? `Chưa nhận được mã? Gửi lại sau ${Math.floor(cooldown / 60)}:${(cooldown % 60)
                .toString()
                .padStart(2, "0")}`
            : isResending
              ? "Đang gửi lại..."
              : "Gửi lại mã"}
        </button>
        <Button type="submit" disabled={isSubmitting || code.length !== 6} className="mt-2 w-full">
          {isSubmitting ? "Đang xác nhận..." : "Xác nhận"}
        </Button>
      </form>
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
