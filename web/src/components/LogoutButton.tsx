"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Signs the user out via NextAuth's `signOut`, redirecting to `/login`.
 * Reused by the settings page and the app-wide nav header. */
export function LogoutButton({ className, variant = "outline" }: {
  className?: string;
  variant?: "outline" | "ghost" | "destructive";
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function handleLogout() {
    setIsLoggingOut(true);
    void signOut({ callbackUrl: "/login" });
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
