"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

import { LogoutButton } from "@/components/LogoutButton";

/** Session-aware wrapper around the presentational `LogoutButton`.
 *
 * `(app)/layout.tsx` is a **server** component and passes this as a
 * `logoutSlot` ReactNode — which is exactly why the wrapper owns `onLogout`
 * itself: a function prop cannot cross the server/client boundary. */
export function LogoutButtonConnected({
  className,
  variant = "outline",
}: {
  className?: string;
  variant?: "outline" | "ghost" | "destructive";
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  return (
    <LogoutButton
      variant={variant}
      className={className}
      pending={isLoggingOut}
      onLogout={() => {
        setIsLoggingOut(true);
        void signOut({ callbackUrl: "/login" });
      }}
    />
  );
}
