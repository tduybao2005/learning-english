"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Signs the user out via `POST /api/auth/logout` (Task 5), then redirects to
 * `/login`. Reused by the settings page and the app-wide nav header. */
export function LogoutButton({ className, variant = "outline" }: {
  className?: string;
  variant?: "outline" | "ghost" | "destructive";
}) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={isLoggingOut}
      onClick={handleLogout}
      className={cn("gap-1.5", className)}
    >
      <LogOut />
      {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
    </Button>
  );
}
