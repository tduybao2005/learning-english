"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  function handleGoogleSignIn() {
    setLoading(true);
    void signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 lg:min-h-0">
      <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-primary-glow lg:hidden">
        H
      </div>
      <h1 className="text-h1 font-extrabold">Chào mừng trở lại 👋</h1>
      <p className="mt-2 text-body text-muted-foreground">
        Đăng nhập bằng tài khoản Google của bạn để tiếp tục.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-8 w-full"
        disabled={loading}
        onClick={handleGoogleSignIn}
      >
        {loading ? "Đang chuyển đến Google..." : "Tiếp tục với Google"}
      </Button>
    </div>
  );
}
