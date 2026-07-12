import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Logout button — presentational. Reused by the settings page and the
 * app-wide nav header.
 *
 * The actual sign-out (the auth library's `signOut`) lives in
 * `LogoutButtonConnected`, which is what the app renders. Keeping the effect
 * out of here is what lets the button ship to the design system. */
export function LogoutButton({
  onLogout,
  pending = false,
  className,
  variant = "outline",
}: {
  /** Invoked on click. The connected wrapper calls NextAuth's `signOut`. */
  onLogout: () => void;
  /** Disables the button and swaps the label while signing out. */
  pending?: boolean;
  className?: string;
  variant?: "outline" | "ghost" | "destructive";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={onLogout}
      className={cn("gap-1.5", className)}
    >
      <LogOut />
      {pending ? "Đang đăng xuất..." : "Đăng xuất"}
    </Button>
  );
}
